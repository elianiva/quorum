-- The Rooms that count against the deployment's cap. A row is a claim made at publish; a Room that
-- expired or went offline leaves its row until a publish that finds the cap full asks each Room.
CREATE TABLE live_rooms (
  code TEXT NOT NULL PRIMARY KEY,
  created_at INTEGER NOT NULL
);
