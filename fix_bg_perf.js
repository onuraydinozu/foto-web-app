const fs = require('fs');
const file = 'components/BackgroundAnimations.tsx';
let content = fs.readFileSync(file, 'utf8');

const newComponent = `export default function BackgroundAnimations() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    // Mobilde kesinlikle çalıştırma - sıfır CPU/GPU tüketimi
    if (typeof window === 'undefined' || window.innerWidth < 768) {
      return;
    }

    setIsDesktop(true);

    const newItems = Array.from({ length: 4 }).map((_, i) => {
      const DrawingComponent = DRAWINGS[Math.floor(Math.random() * DRAWINGS.length)];
      return {
        id: i,
        Component: DrawingComponent,
        left: Math.random() * 100,
        duration: Math.random() * 40 + 40,
        delay: Math.random() * 15,
        scale: Math.random() * 0.8 + 0.8,
      };
    });
    setItems(newItems);
  }, []);

  if (!isDesktop || items.length === 0) return null;

  return (
    <div className="hidden md:block fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-[0.08]">
      {items.map((item) => (
        <motion.div
          key={item.id}
          initial={{ y: "-20vh", x: \`\${item.left}vw\`, rotate: -15 }}
          animate={{
            y: "120vh",
            x: \`\${item.left + (Math.random() * 20 - 10)}vw\`,
            rotate: Math.random() > 0.5 ? 360 : -360,
          }}
          transition={{
            duration: item.duration,
            repeat: Infinity,
            delay: item.delay,
            ease: "linear",
          }}
          className="absolute"
          style={{
            left: \`\${item.left}%\`,
            transform: \`scale(\${item.scale})\`,
          }}
        >
          <item.Component />
        </motion.div>
      ))}
    </div>
  );
}`;

content = content.replace(/export default function BackgroundAnimations\(\) \{[\s\S]*?\n\}/, newComponent);

fs.writeFileSync(file, content);
console.log('Successfully optimized BackgroundAnimations to never mount on mobile!');
