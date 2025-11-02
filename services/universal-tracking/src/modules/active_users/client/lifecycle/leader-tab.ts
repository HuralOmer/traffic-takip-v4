/**
 * Tab Leader Manager
 * Ensures only one tab per session sends TTL refresh
 * Uses BroadcastChannel for cross-tab communication
 */

export interface TabStateInfo {
  state: 'foreground' | 'background';
  lastSeen: number;
}

export class TabLeaderManager {
  private channelName: string;
  private channel: BroadcastChannel | null = null;
  private isLeader: boolean = false;
  private tabId: string;
  private leaderCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastLeaderBeat: number = 0; // Leader beat tracking (kept for compatibility)
  private onLeaderChange: ((isLeader: boolean) => void) | null = null;
  private candidates: Set<string> = new Set(); // ✅ Election candidates tracking
  // 🆕 Tab Tracking
  private allTabs: Map<string, TabStateInfo> = new Map();
  // 🆕 Debouncing için
  private discoveryTimeout: ReturnType<typeof setTimeout> | null = null;
  constructor(customerId: string, sessionId: string, tabId: string) {
    this.channelName = `au_leader_${customerId}_${sessionId}`;
    this.tabId = tabId;
    // Initial state always foreground
    const initialState: 'foreground' | 'background' = 'foreground';
    this.allTabs.set(tabId, { state: initialState, lastSeen: Date.now() });
  }
  /**
   * ✅ HIZLI LEADER ELECTION: Visibility change'de tetikle
   * Sekme foreground'a geçtiğinde hemen leader election başlat
   */
  triggerLeaderElection(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    if (this.isLeader) {
      return; // Already leader, no action needed
    }
    // ✅ FIX: Önce election başlat, SONRA çok kısa bir süre sonra leader ol
    this.broadcast({ type: 'leader_election', tabId: this.tabId });
    // ✅ 20ms bekle (diğer leader'ın resign etmesi için), sonra leader ol
    setTimeout(() => {
      if (!this.isLeader) {
        this.becomeLeader();
      }
    }, 20); // Çok kısa ama yeterli bir süre
  }
  start(onLeaderChange: (isLeader: boolean) => void): void {
    this.onLeaderChange = onLeaderChange;
    if (typeof BroadcastChannel === 'undefined') {
      // BroadcastChannel desteklenmiyor, bu sekme leader olsun
      this.becomeLeader();
      return;
    }
    this.channel = new BroadcastChannel(this.channelName);
    // Diğer sekmelerden mesaj dinle
    this.channel.onmessage = (event) => {
      // ✅ FIX: Kendi mesajlarımızı ignore et (TÜM MESAJ TİPLERİ İÇİN)
      if (event.data.tabId === this.tabId) {
        return; // Kendi mesajımız, ignore et
      }
      if (event.data.type === 'leader_beat') {
        this.lastLeaderBeat = Date.now();
        // ✅ FIX: Başka bir sekme leader, ben resign edeyim (sadece gerçekten leader isem)
        if (this.isLeader) {
                    this.resignLeadership();
        }
      } else if (event.data.type === 'leader_election') {
        // Leader seçimi başladı
                // ✅ FIX: Eğer son 3 saniye içinde leader beat aldıysak, election gereksiz!
        const timeSinceLastBeat = Date.now() - this.lastLeaderBeat;
        if (this.lastLeaderBeat > 0 && timeSinceLastBeat < 3000) {
          return;
        }
                this.participateInElection();
      } else if (event.data.type === 'leader_candidate') {
        // ✅ FIX: Election candidate kaydı
                this.candidates.add(event.data.tabId);
      } 
      // 🆕 Tab state tracking mesajları
      else if (event.data.type === 'tab_state') {
        this.updateTabState(event.data.tabId, event.data.state);
      } else if (event.data.type === 'tab_closed') {
        this.removeTab(event.data.tabId);
      }
      // 🆕 Tab discovery mesajları
      else if (event.data.type === 'who_is_here') {
        // Yeni tab soruyor, kendimi tanıt
                this.announceMyself();
      } else if (event.data.type === 'i_am_here') {
        // Başka bir tab kendini tanıttı, listeye ekle
        this.updateTabState(event.data.tabId, event.data.state);
      }
    };
    // 🆕 Sadece leader election başlat (discovery otomatik olacak)
    this.checkForExistingLeader();
    // Periyodik leader kontrolü (daha az sık kontrol)
    this.leaderCheckInterval = setInterval(() => {
      this.checkLeaderHealth();
    }, 10000); // 10s - çok sık kontrol etme
    // 🆕 Periyodik tab cleanup (eski tab'ları temizle)
    setInterval(() => {
      this.cleanupOldTabs();
    }, 10000); // Her 10 saniyede bir
  }
  private checkForExistingLeader(): void {
    // 🆕 ÖNCE tab discovery başlat
    this.discoverExistingTabs();
    // ✅ FIX: Hemen leader election başlat, beklemeyelim
    this.broadcast({ type: 'leader_election', tabId: this.tabId });
    // 100ms içinde cevap gelmezse leader ol (daha hızlı)
    setTimeout(() => {
      if (!this.isLeader && Date.now() - this.lastLeaderBeat > 100) {
                this.becomeLeader();
      }
    }, 100); // 200ms → 100ms (2x hızlı)
  }
  private checkLeaderHealth(): void {
    if (!this.isLeader) {
      // ✅ FIX: lastLeaderBeat 0 ise henüz leader beat alınmamış, kontrol etme
      if (this.lastLeaderBeat > 0 && Date.now() - this.lastLeaderBeat > 3000) {
        this.broadcast({ type: 'leader_election', tabId: this.tabId });
        this.participateInElection();
      }
    } else {
      // Leader'ım, beat gönder
      this.sendLeaderBeat();
    }
  }
  private participateInElection(): void {
    // ✅ FIX: Zaten leader isem election'a katılma
    if (this.isLeader) {
      return;
    }
    // Clear previous candidates
    this.candidates.clear();
    this.candidates.add(this.tabId); // Kendimi ekle
    // ✅ DETERMINISTIK SEÇIM: TabId'ye göre
        // Candidate olarak kendimi duyur
    this.broadcast({ 
      type: 'leader_candidate', 
      tabId: this.tabId,
      timestamp: Date.now()
    });
    // ✅ FIX: Daha kısa bekleme süresi (race condition'ı azalt)
    setTimeout(() => {
      // ✅ FIX: Alfabetik olarak en küçük tabId kazanır (deterministik)
      const sortedCandidates = Array.from(this.candidates).sort();
      const winner = sortedCandidates[0];
            if (winner === this.tabId) {
        // ✅ Ben kazandım!
        if (!this.isLeader) {
                    this.becomeLeader();
        }
      } else {
        // ✅ Başkası kazandı - sadece gerçekten leader isem resign et
        if (this.isLeader) {
                    this.resignLeadership();
        }
      }
    }, 80); // 150ms → 80ms (çok daha hızlı)
  }
  private becomeLeader(): void {
    if (this.isLeader) return;
    this.isLeader = true;
    // ✅ Duplicate log kaldırıldı (parent StatusLogger kullanacak)
    this.sendLeaderBeat();
    if (this.onLeaderChange) {
      this.onLeaderChange(true);
    }
  }
  private resignLeadership(): void {
    if (!this.isLeader) return;
    this.isLeader = false;
    // ✅ Duplicate log kaldırıldı (parent StatusLogger kullanacak)
    if (this.onLeaderChange) {
      this.onLeaderChange(false);
    }
  }
  private sendLeaderBeat(): void {
    this.broadcast({
      type: 'leader_beat',
      tabId: this.tabId,
      timestamp: Date.now()
    });
  }
  private broadcast(message: any): void {
    if (this.channel) {
      this.channel.postMessage(message);
    }
  }
  isTabLeader(): boolean {
    return this.isLeader;
  }
  // 🆕 Tab state güncelleme (visibility module'den çağrılacak)
  updateMyTabState(state: 'foreground' | 'background'): void {
    this.allTabs.set(this.tabId, { state, lastSeen: Date.now() });
    // Broadcast to other tabs
    this.broadcast({ 
      type: 'tab_state', 
      tabId: this.tabId, 
      state 
    });
  }
  // 🆕 Diğer tab'ın state'ini güncelle
  private updateTabState(tabId: string, state: 'foreground' | 'background'): void {
    if (tabId === this.tabId) return;
    this.allTabs.set(tabId, { state, lastSeen: Date.now() });
  }
  // 🆕 Tab kapandı, listeden çıkar
  private removeTab(tabId: string): void {
    this.allTabs.delete(tabId);
  }
  // 🆕 Tab sayılarını al
  getTabCounts(): { total: number; background: number } {
    const total = this.allTabs.size;
    const background = Array.from(this.allTabs.values()).filter(
      tab => tab.state === 'background'
    ).length;
    return { total, background };
  }
  
  // Get tab states map
  getTabStatesMap(): Map<string, TabStateInfo> {
    return this.allTabs;
  }
  // 🆕 Mevcut tabları keşfet (sadeleştirilmiş)
  private discoverExistingTabs(): void {
        // "Kim var?" mesajı gönder
    this.broadcast({ 
      type: 'who_is_here', 
      tabId: this.tabId 
    });
    // Kendimi hemen announce et
    this.announceMyself();
  }
  // 🆕 Kendimi tanıt
  private announceMyself(): void {
    const myTab = this.allTabs.get(this.tabId);
    if (myTab) {
      this.broadcast({ 
        type: 'i_am_here', 
        tabId: this.tabId,
        state: myTab.state 
      });
    } else {
          }
  }
  // 🆕 Eski tab'ları temizle (30 saniye boyunca mesaj almayan tab'lar)
  private cleanupOldTabs(): void {
    const now = Date.now();
    const maxAge = 30000; // 30 saniye
    const tabsToRemove: string[] = [];
    for (const [tabId, tabData] of this.allTabs.entries()) {
      // Kendi tab'ımı temizleme
      if (tabId === this.tabId) continue;
      // 30 saniye boyunca mesaj almayan tab'ları işaretle
      if (now - tabData.lastSeen > maxAge) {
        tabsToRemove.push(tabId);
      }
    }
    // İşaretlenen tab'ları sil
    for (const tabId of tabsToRemove) {
      this.allTabs.delete(tabId);
    }
  }
  stop(): void {
    if (this.leaderCheckInterval) {
      clearInterval(this.leaderCheckInterval);
    }
    if (this.discoveryTimeout) {
      clearTimeout(this.discoveryTimeout);
    }
    if (this.channel) {
      // Diğer tablara kapandığımı bildir
      this.broadcast({ type: 'tab_closed', tabId: this.tabId });
      // Leadership'i bırak
      if (this.isLeader) {
        this.broadcast({ type: 'leader_election', tabId: this.tabId });
      }
      this.channel.close();
    }
    this.isLeader = false;
  }
}
