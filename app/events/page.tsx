'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface JomonEvent {
  id: string;
  title: string;
  date_start: string;
  date_end?: string;
  location_id?: string;
  facility_name: string;
  prefecture: string;
  region: string;
  url: string;
  category: '企画展' | '体験' | '講座' | '特別公開' | 'その他';
  description: string;
}

const REGION_MAP: Record<string, string> = {
  all: '全国',
  Hokkaido: '北海道・東北',
  Tohoku: '北海道・東北',
  Kanto: '関東',
  Chubu: '中部',
  Kinki: '近畿',
  Chugoku: '中国',
  Shikoku: '四国',
  Kyushu: '九州・沖縄',
  Okinawa: '九州・沖縄',
};

const REGION_TABS = ['all', 'Hokkaido', 'Kanto', 'Chubu', 'Kinki', 'Chugoku', 'Shikoku', 'Kyushu'] as const;

const REGION_COLORS: Record<string, string> = {
  Hokkaido: '#1A5276',
  Tohoku: '#2E6B35',
  Kanto: '#1B6FA8',
  Chubu: '#7A5C1E',
  Kinki: '#6B3A6E',
  Chugoku: '#1A7070',
  Shikoku: '#8A4B1A',
  Kyushu: '#9B2B2B',
  Okinawa: '#0E8C7A',
};

const CATEGORY_ICONS: Record<string, string> = {
  '企画展': '🎨',
  '体験': '✍️',
  '講座': '🎓',
  '特別公開': '✨',
  'その他': '📋',
};

export default function EventsPage() {
  const [events, setEvents] = useState<JomonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/events');
        const data = await res.json();
        setEvents(data);
      } catch (error) {
        console.error('[events page]', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const upcoming: JomonEvent[] = [];
    const past: JomonEvent[] = [];

    events.forEach((event) => {
      const endDate = new Date(event.date_end || event.date_start);
      endDate.setHours(23, 59, 59, 999);

      if (endDate < today) {
        past.push(event);
      } else {
        upcoming.push(event);
      }
    });

    // Sort by date_start ascending
    upcoming.sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
    past.sort((a, b) => new Date(b.date_end || b.date_start).getTime() - new Date(a.date_end || a.date_start).getTime());

    return { upcomingEvents: upcoming, pastEvents: past };
  }, [events]);

  const filteredUpcoming = useMemo(() => {
    if (selectedRegion === 'all') return upcomingEvents;
    return upcomingEvents.filter((e) => e.region === selectedRegion);
  }, [upcomingEvents, selectedRegion]);

  const filteredPast = useMemo(() => {
    if (selectedRegion === 'all') return pastEvents;
    return pastEvents.filter((e) => e.region === selectedRegion);
  }, [pastEvents, selectedRegion]);

  const isWithinSevenDays = (dateStr: string): boolean => {
    const eventDate = new Date(dateStr);
    eventDate.setHours(0, 0, 0, 0);
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  const EventCard = ({ event, isPast }: { event: JomonEvent; isPast: boolean }) => {
    const regionColor = REGION_COLORS[event.region] || '#666';
    const isNew = !isPast && isWithinSevenDays(event.date_start);
    const startDate = new Date(event.date_start);
    const endDate = event.date_end ? new Date(event.date_end) : startDate;
    const startStr = `${startDate.getMonth() + 1}/${startDate.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][startDate.getDay()]})`;
    const endStr = event.date_end ? `${endDate.getMonth() + 1}/${endDate.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][endDate.getDay()]})` : null;

    return (
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--glass-border)',
          borderRadius: '14px',
          padding: '14px',
          marginBottom: '12px',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          opacity: isPast ? 0.45 : 1,
          filter: isPast ? 'grayscale(0.5)' : 'none',
          transform: isPast ? 'none' : 'translateY(0)',
        }}
        onMouseEnter={(e) => !isPast && (e.currentTarget.style.transform = 'translateY(-2px)')}
        onMouseLeave={(e) => !isPast && (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {isNew && (
            <span style={{
              backgroundColor: '#B8401A',
              color: 'white',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '4px',
            }}>
              🔥 NEW
            </span>
          )}
          {isPast && (
            <span style={{
              backgroundColor: '#999',
              color: 'white',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '4px',
            }}>
              終了
            </span>
          )}
          <span style={{
            backgroundColor: '#F5F5F5',
            color: '#333',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
          }}>
            {CATEGORY_ICONS[event.category]} {event.category}
          </span>
          <span style={{
            backgroundColor: regionColor,
            color: 'white',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
          }}>
            {event.prefecture}
          </span>
        </div>

        <h3 style={{
          margin: '0 0 6px 0',
          fontSize: '14px',
          fontWeight: '600',
          color: 'var(--text-primary)',
          lineHeight: '1.4',
        }}>
          {event.title}
        </h3>

        <p style={{
          margin: '4px 0 8px 0',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}>
          📅 {startStr}
          {endStr && ` 〜 ${endStr}`}
        </p>

        <p style={{
          margin: '4px 0 10px 0',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: '1.4',
        }}>
          {event.description}
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {event.location_id && (
            <Link
              href={`/facility/${event.location_id}`}
              style={{
                fontSize: '12px',
                padding: '4px 8px',
                backgroundColor: 'var(--accent-forest)',
                color: 'white',
                borderRadius: '4px',
                textDecoration: 'none',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              🏛 {event.facility_name} →
            </Link>
          )}
          {!event.location_id && (
            <span style={{
              fontSize: '12px',
              padding: '4px 8px',
              backgroundColor: '#DDD',
              color: '#666',
              borderRadius: '4px',
            }}>
              🏛 {event.facility_name}
            </span>
          )}
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '12px',
              padding: '4px 8px',
              backgroundColor: 'var(--accent-terracotta)',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            詳細を見る →
          </a>
        </div>
      </div>
    );
  };

  const currentMonth = new Date();
  const monthYearStr = `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`;

  return (
    <div style={{ padding: '15px', maxWidth: '900px', margin: '0 auto' }}>
      <header style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Link
            href="/"
            style={{ color: 'var(--accent-terracotta)', textDecoration: 'none', fontSize: '14px' }}
          >
            ← トップへ
          </Link>
        </div>
        <h1 style={{ margin: '0 0 4px 0', fontSize: 'clamp(20px, 5vw, 28px)', color: '#1C150A' }}>
          🏺 縄文イベント情報
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>{monthYearStr}</p>
      </header>

      {/* Region Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {REGION_TABS.map((region) => (
          <button
            key={region}
            onClick={() => setSelectedRegion(region)}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: selectedRegion === region ? '600' : '400',
              cursor: 'pointer',
              backgroundColor: selectedRegion === region ? 'var(--accent-terracotta)' : '#EEE',
              color: selectedRegion === region ? 'white' : '#333',
              borderBottom: selectedRegion === region ? '2px solid #8B2A0A' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {REGION_MAP[region]}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
          <p style={{ fontSize: '14px' }}>イベント情報を読み込み中...</p>
        </div>
      )}

      {/* Upcoming Events */}
      {!loading && filteredUpcoming.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: 'clamp(16px, 4vw, 18px)', color: 'var(--accent-terracotta)', borderBottom: '2px solid var(--accent-terracotta)', paddingBottom: '8px' }}>
            🔥 開催中・直近のイベント
          </h2>
          {filteredUpcoming.map((event) => (
            <EventCard key={event.id} event={event} isPast={false} />
          ))}
        </div>
      )}

      {/* Empty State for Upcoming */}
      {!loading && filteredUpcoming.length === 0 && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '2px dashed var(--glass-border)',
          borderRadius: '14px',
          padding: '40px 20px',
          marginBottom: '30px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}>
          <p style={{ fontSize: '18px', margin: '0 0 8px 0' }}>🏺</p>
          <p style={{ fontSize: '14px', margin: '0', fontWeight: '500' }}>
            現在、この地方のイベント情報はありません。<br />発掘調査中...
          </p>
        </div>
      )}

      {/* Past Events */}
      {!loading && filteredPast.length > 0 && (
        <div>
          <h2 style={{ margin: '0 0 12px 0', fontSize: 'clamp(16px, 4vw, 18px)', color: '#999', borderBottom: '2px solid #DDD', paddingBottom: '8px' }}>
            📜 終了したイベント
          </h2>
          {filteredPast.map((event) => (
            <EventCard key={event.id} event={event} isPast={true} />
          ))}
        </div>
      )}
    </div>
  );
}
