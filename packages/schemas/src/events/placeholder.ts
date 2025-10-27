export const placeholderSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  title: "Placeholder Event",
  description: "Placeholder event schema - Yeni tracking modülleri için hazır",
  properties: {
    event_type: {
      type: "string",
      description: "Type of event"
    },
    timestamp: {
      type: "number",
      description: "Unix timestamp in milliseconds"
    },
    user_id: {
      type: "string",
      description: "User identifier"
    },
    session_id: {
      type: "string",
      description: "Session identifier"
    },
    site_id: {
      type: "string",
      description: "Site identifier"
    },
    data: {
      type: "object",
      description: "Event data"
    }
  },
  required: ["event_type", "timestamp"],
  additionalProperties: false
} as const;

