import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme';

interface ProgressStepperProps {
  currentStep: number; // 0 to 3
}

export function ProgressStepper({ currentStep }: ProgressStepperProps) {
  const steps = [1, 2, 3, 4];
  return (
    <View style={styles.stepperContainer}>
      {steps.map((step, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = idx < currentStep;
        
        return (
          <React.Fragment key={step}>
            {idx > 0 && (
              <View style={[styles.stepperLine, idx <= currentStep && styles.stepperLineActive]} />
            )}
            <View
              style={[
                styles.stepCircle,
                isActive && styles.stepCircleActive,
                isCompleted && styles.stepCircleCompleted
              ]}
            >
              <Text style={[styles.stepText, (isActive || isCompleted) && styles.stepTextActive]}>
                {isCompleted ? '✓' : step}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: theme.spacing.lg,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight || '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stepCircleActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stepCircleCompleted: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  stepText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepTextActive: {
    color: '#FFFFFF',
  },
  stepperLine: {
    flex: 1,
    maxWidth: 40,
    height: 2,
    backgroundColor: theme.colors.surfaceLight || '#334155',
  },
  stepperLineActive: {
    backgroundColor: theme.colors.primary,
  },
});
