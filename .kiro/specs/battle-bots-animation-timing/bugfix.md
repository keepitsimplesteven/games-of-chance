# Bugfix Requirements Document

## Introduction

The Battle Bots combat animation has two related visual timing issues. First, projectile animations transition abruptly between phases — appearing and disappearing instantly rather than fading smoothly — creating a choppy visual experience. Second, HP damage and "Defeated" status are applied immediately when a tick fires, before the projectile animation has traveled and impacted the target, breaking the visual cause-and-effect relationship between the animation and its gameplay result.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a projectile exits the attacker (exit phase completes) THEN the system abruptly hides the projectile with no opacity transition at the end of the phase

1.2 WHEN a projectile enters the travel phase (approaching target) THEN the system instantly shows the projectile at full opacity with no fade-in transition

1.3 WHEN the delay phase is active between exit and travel THEN the system renders the projectile at opacity 0 with no gradual transition from the preceding exit phase

1.4 WHEN a tick fires from the ReplayController containing attack data THEN the system immediately updates hpStates (deducting HP) before the projectile animation begins

1.5 WHEN a tick contains an elimination THEN the system immediately marks the robot as "Defeated" and shows 0 HP before the killing blow projectile has reached the target

### Expected Behavior (Correct)

2.1 WHEN a projectile is in the exit phase THEN the system SHALL animate opacity from 1 to 0 over the exit duration so the projectile fades out smoothly as it leaves the attacker

2.2 WHEN a projectile enters the travel phase THEN the system SHALL animate opacity from 0 to 1 over the travel duration so the projectile fades in smoothly as it approaches the target

2.3 WHEN the delay phase is active THEN the system SHALL keep the projectile at opacity 0 (no visual change from end of exit fade-out to start of travel fade-in)

2.4 WHEN a tick fires from the ReplayController THEN the system SHALL defer HP updates until the projectile animation completes and handleProjectileImpact is called in AnimationLayer

2.5 WHEN a tick contains an elimination THEN the system SHALL defer marking the robot as "Defeated" until the projectile impact animation completes for that killing blow

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a projectile is in the exit phase THEN the system SHALL CONTINUE TO move the projectile from attackerOrigin to attackerExit over the exit duration (30% of gameSpeed)

3.2 WHEN a projectile is in the travel phase THEN the system SHALL CONTINUE TO move the projectile from targetEntry to targetImpact over the travel duration (50% of gameSpeed)

3.3 WHEN a projectile completes the travel phase (impact) THEN the system SHALL CONTINUE TO trigger hit effect SVGs and floating damage numbers via handleProjectileImpact

3.4 WHEN gameSpeed is below 150ms (fast speed) THEN the system SHALL CONTINUE TO apply the 0.9 clamping factor to phase durations

3.5 WHEN a robot's attacker or target is already eliminated THEN the system SHALL CONTINUE TO skip projectile creation for that attack

3.6 WHEN all projectile impacts for a tick have completed THEN the system SHALL CONTINUE TO reflect the final correct HP values (same totals as before, just deferred in timing)

3.7 WHEN the replay is complete THEN the system SHALL CONTINUE TO determine the winner based on final hpStates and fire the onComplete callback
