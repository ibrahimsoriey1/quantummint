import { useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function useIdempotency() {
  const keyRef = useRef(uuidv4());
  const renew = () => {
    keyRef.current = uuidv4();
    return keyRef.current;
  };
  const get = () => keyRef.current;
  return { get, renew };
}


