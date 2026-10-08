const fs = require('fs');
let file = 'app/room/[short_id]/page.tsx';
// Find the exact path
const fg = require('child_process').execSync('find app/room -name "page.tsx"').toString().trim();
let content = fs.readFileSync(fg, 'utf8');

// Add channel state
content = content.replace(
  `const channelRef = useRef<any>(null);`,
  `const channelRef = useRef<any>(null);\n  const [channelState, setChannelState] = useState<any>(null);`
);

// Update channelState inside useEffect where channelRef is set
content = content.replace(
  `channelRef.current = roomChannel;`,
  `channelRef.current = roomChannel;\n      setChannelState(roomChannel);`
);

// Change PollsCard prop
content = content.replace(
  `<PollsCard roomId={room?.id || params.short_id} channel={channelRef.current} />`,
  `<PollsCard roomId={room?.id || params.short_id} channel={channelState} />`
);

fs.writeFileSync(fg, content);
console.log('Fixed channel propagation to PollsCard!');
