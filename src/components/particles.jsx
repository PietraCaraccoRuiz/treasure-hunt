export default function Particles({ count = 20, color = "#ffd700" }) {
    const particles = Array.from({ length: count }, (_, i) => ({
        id: i,
        x: seededValue(i, 17) * 100,
        drift: -16 + seededValue(i, 23) * 32,
        delay: seededValue(i, 41) * 6,
        duration: 7 + seededValue(i, 73) * 7,
        size: 3 + seededValue(i, 109) * 6,
        opacity: 0.28 + seededValue(i, 151) * 0.34,
    }));

    return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            {particles.map((p) => (
                <div
                    key={p.id}
                    style={{
                        position: "absolute",
                        left: `${p.x}%`,
                        bottom: "-10px",
                        width: p.size,
                        height: p.size,
                        borderRadius: "50%",
                        background: color,
                        opacity: p.opacity,
                        boxShadow: `0 0 ${p.size * 2.4}px ${color}`,
                        "--drift-x": `${p.drift}px`,
                        "--spark-opacity": p.opacity,
                        animation: `float ${p.duration}s ${p.delay}s infinite ease-in-out`,
                    }}
                />
            ))}
        </div>
    );
}

function seededValue(index, salt) {
    const x = Math.sin(index * 92821 + salt * 131) * 10000;
    return x - Math.floor(x);
}
