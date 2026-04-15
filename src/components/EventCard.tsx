type EventItem = {
  id: string;
  title: string;
  event_type: string;
  start_at: string;
  end_at?: string | null;
  organizer?: string | null;
  url?: string | null;
  city?: string | null;
  is_online?: boolean | null;
  venue_name?: string | null;
  country_name: string;
};

export function EventCard({ e }: { e: EventItem }) {
  const when = new Date(e.start_at).toLocaleString();
  
  return (
    <div className="uni-card">
      <div className="uni-card__body">
        <h3 className="title">{e.title}</h3>
        <div className="loc">
          {e.country_name}
          {e.city ? `، ${e.city}` : ""} • {e.event_type}
        </div>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "6px 0",
            display: "grid",
            gap: 6,
          }}
        >
          <li>التاريخ/الوقت: {when}</li>
          {e.venue_name && <li>المكان: {e.venue_name}</li>}
          {e.organizer && <li>المنظِّم: {e.organizer}</li>}
        </ul>

        <div className="actions">
          {e.url && (
            <a href={e.url} target="_blank" rel="noreferrer">
              Register
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
