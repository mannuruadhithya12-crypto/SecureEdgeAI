import { useState, useRef } from 'react';
import { resetBlinkHistory } from '../liveness/blinkDetection';
import { resetHeadMovementHistory } from '../liveness/headMovement';
import { resetAntiSpoofHistory } from '../security/antiSpoofing';

export function useLiveness() {
  const [livenessBlink, setLivenessBlink] = useState(false);
  const [livenessHead, setLivenessHead] = useState(false);
  
  const lastBlinkTimeRef = useRef<number>(0);
  const lastHeadMovementTimeRef = useRef<number>(0);

  const resetLivenessState = () => {
    setLivenessBlink(false);
    setLivenessHead(false);
    lastBlinkTimeRef.current = 0;
    lastHeadMovementTimeRef.current = 0;
    
    resetBlinkHistory();
    resetHeadMovementHistory();
    resetAntiSpoofHistory();
  };

  return {
    livenessBlink,
    setLivenessBlink,
    livenessHead,
    setLivenessHead,
    lastBlinkTimeRef,
    lastHeadMovementTimeRef,
    resetLivenessState,
  };
}
