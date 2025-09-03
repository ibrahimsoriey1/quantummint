import React, { useEffect, useState } from 'react';

const services = [
  { name: 'Gateway', path: '/ready' },
  { name: 'Auth', path: '/auth/ready' },
  { name: 'MoneyGen', path: '/generation/ready' },
  { name: 'Tx', path: '/transactions/ready' },
  { name: 'Payments', path: '/payments/ready' },
  { name: 'KYC', path: '/kyc/ready' },
];

const ReadinessBadge = () => {
  const [status, setStatus] = useState({});

  useEffect(() => {
    let mounted = true;
    const fetchStatuses = async () => {
      const results = await Promise.allSettled(
        services.map(s => fetch(`/api${s.path}`).then(r => ({ name: s.name, ok: r.ok })).catch(() => ({ name: s.name, ok: false })))
      );
      if (!mounted) return;
      const next = {};
      results.forEach(r => {
        if (r.status === 'fulfilled') next[r.value.name] = r.value.ok;
      });
      setStatus(next);
    };
    fetchStatuses();
    const id = setInterval(fetchStatuses, 15000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {services.map(s => (
        <span key={s.name} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 12, background: status[s.name] ? '#e6ffed' : '#ffecec', color: status[s.name] ? '#036400' : '#9d0006' }}>
          {s.name}
        </span>
      ))}
    </div>
  );
};

export default ReadinessBadge;


