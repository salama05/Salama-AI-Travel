/**
 * lib/entities.ts
 *
 * WHY THIS FILE EXISTS:
 * The LLM needs a stable, typed view of our Supabase tables. Raw database rows
 * have database-specific column names and timestamps. Business entities are clean,
 * human-readable objects the agent can reason about. We also declare MCP "tool"
 * function signatures so Gemini knows exactly what it can call.
 */

// ─── Business Entity Types ────────────────────────────────────────────────────

export interface FlightEntity {
  id: string;
  flightNumber: string;
  airline: string;
  /** Full enriched label: "Los Angeles (LAX)" — used for semantic search matching */
  departure: string;
  departureCode: string;
  /** Full enriched label: "Tokyo (HND)" */
  arrival: string;
  arrivalCode: string;
  departureTime: string; // ISO-8601
  arrivalTime: string;
  priceUSD: number;
  status: 'scheduled' | 'delayed' | 'cancelled';
}

export interface BookingEntity {
  id: string;
  bookingReference: string;
  userId: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  departureTime: string;
  seatNumber: string | null;
  status: 'confirmed' | 'cancelled';
  bookedAt: string;
}

export interface ETicketEntity {
  id: string;
  bookingId: string;
  userId: string;
  qrData: string;
  status: 'valid' | 'active' | 'boarded' | 'scanned' | 'invalid';
  createdAt: string;
  passportNumber?: string | null;
  passportExpiry?: string | null;
  // Included via joins for the boarding pass UI
  bookingReference?: string;
  seatNumber?: string | null;
  flight?: FlightEntity;
}

export interface SupportTicketEntity {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: 'open' | 'resolved' | 'closed';
  createdAt: string;
  /** Present only in admin views — populated via JOIN on profiles */
  userEmail?: string;
}

/** Valid status transitions for admin resolution workflow */
export const TICKET_STATUSES = ['open', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];


// ─── Airport City Name Map ─────────────────────────────────────────────────────
// Used to enrich airport codes with city names for semantic search.
// "flights to Tokyo" → matches "Tokyo (HND)" in the vector index.
export const AIRPORT_CITY_MAP: Record<string, string> = {
  LAX: 'Los Angeles',
  JFK: 'New York',
  SFO: 'San Francisco',
  HND: 'Tokyo',
  NRT: 'Tokyo Narita',
  LHR: 'London Heathrow',
  LGW: 'London Gatwick',
  CDG: 'Paris Charles de Gaulle',
  DXB: 'Dubai',
  AMS: 'Amsterdam',
  FRA: 'Frankfurt',
  SIN: 'Singapore',
  HKG: 'Hong Kong',
  BKK: 'Bangkok',
  SYD: 'Sydney',
  ORD: 'Chicago O\'Hare',
  MIA: 'Miami',
  SEA: 'Seattle',
  IAD: 'Washington Dulles',
  BOS: 'Boston',
};

/** Enrich a bare airport code into "City (CODE)" format */
export function enrichAirport(code: string): string {
  const city = AIRPORT_CITY_MAP[code.toUpperCase()];
  return city ? `${city} (${code.toUpperCase()})` : code.toUpperCase();
}

// ─── Supabase Row → Business Entity Mappers ───────────────────────────────────

export function mapFlight(row: Record<string, unknown>): FlightEntity {
  return {
    id: String(row.id),
    flightNumber: String(row.flight_number),
    airline: String(row.airline),
    departureCode: String(row.departure_airport),
    departure: enrichAirport(String(row.departure_airport)),
    arrivalCode: String(row.arrival_airport),
    arrival: enrichAirport(String(row.arrival_airport)),
    departureTime: String(row.departure_time),
    arrivalTime: String(row.arrival_time),
    priceUSD: Number(row.price),
    status: (row.status as FlightEntity['status']) ?? 'scheduled',
  };
}

export function mapBooking(
  row: Record<string, unknown>,
  flight?: Record<string, unknown>
): BookingEntity {
  return {
    id: String(row.id),
    bookingReference: String(row.booking_reference),
    userId: String(row.user_id),
    flightNumber: flight ? String(flight.flight_number) : '',
    departure: flight ? enrichAirport(String(flight.departure_airport)) : '',
    arrival: flight ? enrichAirport(String(flight.arrival_airport)) : '',
    departureTime: flight ? String(flight.departure_time) : '',
    seatNumber: row.seat_number ? String(row.seat_number) : null,
    status: (row.status as BookingEntity['status']) ?? 'confirmed',
    bookedAt: String(row.created_at),
  };
}

export function mapETicket(
  row: Record<string, unknown>,
  bookingRow?: Record<string, unknown>,
  flightRow?: Record<string, unknown>
): ETicketEntity {
  return {
    id: String(row.id),
    bookingId: String(row.booking_id),
    userId: String(row.user_id),
    qrData: String(row.qr_data),
    status: (row.status as ETicketEntity['status']) ?? 'valid',
    createdAt: String(row.created_at),
    passportNumber: row.passport_number ? String(row.passport_number) : null,
    passportExpiry: row.passport_expiry ? String(row.passport_expiry) : null,
    bookingReference: bookingRow ? String(bookingRow.booking_reference) : undefined,
    seatNumber: bookingRow?.seat_number ? String(bookingRow.seat_number) : null,
    flight: flightRow ? mapFlight(flightRow) : undefined,
  };
}

export function mapTicket(row: Record<string, unknown>): SupportTicketEntity {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    subject: String(row.subject),
    description: String(row.description),
    status: (row.status as SupportTicketEntity['status']) ?? 'open',
    createdAt: String(row.created_at),
    // userEmail is injected when the query JOINs profiles (admin view only)
    userEmail: row.userEmail ? String(row.userEmail) : undefined,
  };
}

// ─── MCP Tool Declarations ─────────────────────────────────────────────────────
// Gemini reads these JSON schemas to decide WHEN to call each tool.
// The agent calls "search_flights" when user asks about flights,
// "get_user_bookings" when asking about their reservations, etc.

export const MCP_TOOLS = [
  {
    name: 'search_flights',
    description:
      'Search available flights using hybrid vector + structured filter. Use this when the user asks about flights, routes, prices, or availability. ' +
      'Accepts natural language queries like "cheap flight to Tokyo" or structured filters.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Natural language search query, e.g. "flights from Dubai to Paris next week"',
        },
        departureCode: {
          type: 'string',
          description: 'IATA departure airport code, e.g. "LAX". Optional.',
        },
        arrivalCode: {
          type: 'string',
          description: 'IATA arrival airport code, e.g. "HND". Optional.',
        },
        maxPriceUSD: {
          type: 'number',
          description: 'Maximum price in USD. Optional.',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return. Default 5.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_user_bookings',
    description:
      'Retrieve the authenticated user\'s confirmed flight bookings. Call this when the user asks about their reservations, tickets, or travel history.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_user_tickets',
    description:
      'Retrieve the authenticated user\'s open support tickets. Call this when the user asks about their support requests or complaints.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
] as const;

export type McpToolName = (typeof MCP_TOOLS)[number]['name'];
