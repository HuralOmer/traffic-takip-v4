function App() {
  console.log('🚀 App component rendering...');

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f0f0f0', 
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ 
        color: 'blue', 
        fontSize: '2rem',
        marginBottom: '20px'
      }}>
        🚀 Universal Tracking Dashboard
      </h1>
      
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h2>Dashboard Durumu</h2>
        <p>✅ React uygulaması başarıyla yüklendi!</p>
        <p>🕐 Zaman: {new Date().toLocaleString()}</p>
        <p>🧹 Tracking modülleri temizlendi</p>
        <p>🔄 Yeni tracking modülleri kurulacak</p>
        <p>🐳 Docker altyapısı korundu (Redis, ClickHouse, PostgreSQL)</p>
      </div>

      <div style={{
        backgroundColor: '#e8f4fd',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h3>🔧 Altyapı Durumu</h3>
        <p>✅ Redis: Hazır</p>
        <p>✅ ClickHouse: Hazır</p>
        <p>✅ PostgreSQL: Hazır</p>
        <p>✅ Docker Container'lar: Çalışıyor</p>
      </div>
    </div>
  );
}

export default App;