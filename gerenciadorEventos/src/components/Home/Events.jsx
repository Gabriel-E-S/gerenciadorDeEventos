import React from 'react';
import './Events.css';

export default function Events() {
  const events = [
    { id: 1, title: 'EAIC XXXIV - Apresentações', date: '25 Nov 2025', local: 'Auditório Central - CSA' },
    { id: 2, title: 'Torneio de Derivadas - SIGMAT', date: '10 Set 2024', local: 'Sala 02 - CSA' },
    { id: 3, title: 'CIMPEC 2', date: '15 Set 2023', local: 'UEPG - Campus Uvaranas' }
  ];

  return (
    <section className="events-section" id="events">
      <h2 className="section-title">Eventos já realizados</h2>
      <div className="events-grid">
        {events.map((evt) => (
          <div key={evt.id} className="event-card">
            <div className="event-details">
              <h3>{evt.title}</h3>
              <p className="event-meta"> Data: {evt.date}</p>
              <p className="event-meta"> Local: {evt.local}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}