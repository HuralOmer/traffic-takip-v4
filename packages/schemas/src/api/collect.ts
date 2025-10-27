export const collectSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  title: "Collect API Request",
  description: "API request for collecting tracking events - Yeni modüller için hazır",
  properties: {
    events: {
      type: "array",
      items: {
        oneOf: [
          { $ref: "../events/placeholder.json" }
        ]
      },
      minItems: 1,
      maxItems: 100
    },
    site_id: {
      type: "string",
      description: "Site identifier for multi-tenant support"
    },
    timestamp: {
      type: "number",
      description: "Request timestamp in milliseconds"
    },
    signature: {
      type: "string",
      description: "HMAC signature for request validation"
    }
  },
  required: ["events", "site_id", "timestamp"],
  additionalProperties: false
} as const;

