# SecureEdgeAI Meeting Notes

## Day 1: Kickoff & Environment Setup Alignment

**Date**: May 24, 2026  
**Attendees**: Member 1, Member 2, Member 3  

### Agenda
1. Establish git branch workflow and structures.
2. Align on mobile UI/camera preview requirements.
3. Validate Python virtual environment and offline TFLite inference stubs.

### Decisions Made
- **Git workflow**: We will use a main-dev model. Features are developed on separate branches (`feature/mobile`, `feature/ai`, `feature/backend`) and merged into `dev` via pull request.
- **Model inputs**: Face recognition model expects `112x112` RGB input, outputting `192-dimensional` floating-point embedding vector.
- **Native interfaces**: We use `react-native-nitro-modules` for high performance JNI/C++ bridges.
