export default function TileHead({ kicker, title, id, tilt = 0, align = 'center', as: Tag = 'h2' }) {
  return (
    <div className="tilehead" style={{ transform: `rotate(${tilt}deg)`, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      {kicker && <span>{kicker}</span>}
      <Tag id={id} className="pill">{title}</Tag>
    </div>
  )
}
