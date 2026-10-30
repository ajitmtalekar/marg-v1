import React from 'react'
import exhibits from '../data/exhibits.json'

export default function ExhibitList({ onSelect }) {
  return (
    <div className="exhibit-list">
      <h3>Exhibits</h3>
      <ul>
        {exhibits.map((ex) => (
          <li key={ex.id}>
            <button onClick={() => onSelect(ex.id)}>{ex.name}</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
