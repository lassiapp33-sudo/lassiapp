import { useRef, useState, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import logger from '../utils/logger';

// Options d'enregistrement cross-platform — produit toujours un .m4a
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension:     '.m4a',
    outputFormat:  Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder:  Audio.AndroidAudioEncoder.AAC,
    sampleRate:    44100,
    numberOfChannels: 1,
    bitRate:       96000,
  },
  ios: {
    extension:     '.m4a',
    outputFormat:  Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality:  Audio.IOSAudioQuality.MEDIUM,
    sampleRate:    44100,
    numberOfChannels: 1,
    bitRate:       96000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat:    false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 96000 },
};

export interface VoiceResult {
  uri:      string;
  duration: number; // secondes
}

export interface UseVoiceRecorderReturn {
  isRecording:      boolean;
  elapsed:          number;         // secondes écoulées
  startRecording:   () => Promise<void>;
  stopRecording:    () => Promise<VoiceResult | null>;
  cancelRecording:  () => Promise<void>;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed,     setElapsed]     = useState(0);

  const recordingRef  = useRef<Audio.Recording | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef  = useRef(0);

  // Nettoyage en cas de démontage
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const startRecording = useCallback(async () => {
    // Demander la permission micro
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:   true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recordingRef.current = recording;
      startTimeRef.current = Date.now();

      setIsRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      logger.warn('[VoiceRecorder] startRecording:', err);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<VoiceResult | null> => {
    if (!recordingRef.current) return null;

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const durationSec = Math.floor((Date.now() - startTimeRef.current) / 1000);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      setElapsed(0);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});

      if (!uri || durationSec < 1) return null; // trop court
      return { uri, duration: durationSec };
    } catch (err) {
      logger.warn('[VoiceRecorder] stopRecording:', err);
      recordingRef.current = null;
      setIsRecording(false);
      return null;
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { await recordingRef.current?.stopAndUnloadAsync(); } catch {}
    recordingRef.current = null;
    setIsRecording(false);
    setElapsed(0);
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  }, []);

  return { isRecording, elapsed, startRecording, stopRecording, cancelRecording };
}
