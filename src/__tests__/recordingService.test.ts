jest.mock("react-native-audio-recorder-player", () => {
  return {
    __esModule: true,
    default: class AudioRecorderPlayer {
      startRecorder = jest.fn().mockResolvedValue("mock-audio-uri");
      stopRecorder = jest.fn().mockResolvedValue("mock-audio-uri");
      addRecordBackListener = jest.fn();
      removeRecordBackListener = jest.fn();
      setSubscriptionDuration = jest.fn();
    },
  };
});

import {
  RecordingService,
  resetRecordingService,
  destroyRecordingService,
} from "../services/recordingService";

describe("RecordingService Singleton Reset", () => {
  beforeEach(() => {
    resetRecordingService();
  });

  afterEach(() => {
    destroyRecordingService();
  });

  test("should reset singleton instance completely", () => {
    const instance1 = RecordingService.getInstance();
    instance1.setWhisperThreshold(0.5);
    instance1.setCallbacks({
      onAudioLevelChange: () => {},
      onError: () => {},
    });
    expect(instance1.getWhisperThreshold()).toBe(0.5);
    expect(instance1.getRecordingState().isRecording).toBe(false);
    resetRecordingService();
    const instance2 = RecordingService.getInstance();
    expect(instance2.getWhisperThreshold()).toBe(0.008); // Default threshold
    expect(instance2.getRecordingState().isRecording).toBe(false);
    expect(instance1).not.toBe(instance2);
  });

  test("should destroy singleton instance completely", () => {
    const instance1 = RecordingService.getInstance();
    destroyRecordingService();
    const instance2 = RecordingService.getInstance();
    expect(instance1).not.toBe(instance2);
    expect(instance2.getWhisperThreshold()).toBe(0.008); // Default threshold
  });

  test("should handle multiple reset calls safely", () => {
    const instance1 = RecordingService.getInstance();
    resetRecordingService();
    resetRecordingService();
    resetRecordingService();
    const instance2 = RecordingService.getInstance();
    expect(instance1).not.toBe(instance2);
    expect(instance2.getWhisperThreshold()).toBe(0.008);
  });

  test("should handle multiple destroy calls safely", () => {
    const instance1 = RecordingService.getInstance();
    destroyRecordingService();
    destroyRecordingService();
    destroyRecordingService();
    const instance2 = RecordingService.getInstance();
    expect(instance1).not.toBe(instance2);
    expect(instance2.getWhisperThreshold()).toBe(0.008);
  });
});
