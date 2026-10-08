const fs = require('fs');
const file = 'components/PollsCard.tsx';
let content = fs.readFileSync(file, 'utf8');

const effectAnchor = `  // 2. REALTIME KANAL DİNLEME (Başka biri soru/aday/oy eklediğinde anında güncelle)
  useEffect(() => {
    if (!channel) return;

    const subscription = channel.on('broadcast', { event: 'polls_updated' }, ({ payload }: any) => {
      if (payload && Array.isArray(payload.polls)) {
        setPolls(payload.polls);
        try {
          localStorage.setItem(storageKey, JSON.stringify(payload.polls));
        } catch (e) {}
      }
    });

    return () => {
      // Cleanup if needed
    };
  }, [channel, storageKey]);`;

const effectReplacement = `  // 2. REALTIME KANAL DİNLEME (Başka biri soru/aday/oy eklediğinde anında güncelle)
  useEffect(() => {
    const handlePollsUpdated = (e: any) => {
      const payload = e.detail;
      if (payload && Array.isArray(payload.polls)) {
        setPolls(payload.polls);
        try {
          localStorage.setItem(storageKey, JSON.stringify(payload.polls));
        } catch (err) {}
      }
    };
    
    window.addEventListener('polls_updated', handlePollsUpdated);
    return () => {
      window.removeEventListener('polls_updated', handlePollsUpdated);
    };
  }, [storageKey]);`;

content = content.replace(effectAnchor, effectReplacement);
fs.writeFileSync(file, content);
console.log('Fixed PollsCard.tsx');
