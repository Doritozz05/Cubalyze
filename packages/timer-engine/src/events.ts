import { TimerState } from './TimerState';
import { Penalty } from './WcaRules';

export interface TimerTickEventDetail {
  timeMs: number;
  state: TimerState;
}

export interface TimerStateChangeEventDetail {
  previousState: TimerState;
  newState: TimerState;
}

export interface TimerPenaltyEventDetail {
  penalty: Penalty;
}

export interface TimerStopEventDetail {
  timeMs: number;
  penalty: Penalty;
  finalTimeMs: number;
}

// Custom Event classes to preserve typing
export class TimerTickEvent extends CustomEvent<TimerTickEventDetail> {
  constructor(detail: TimerTickEventDetail) {
    super('tick', { detail });
  }
}

export class TimerStateChangeEvent extends CustomEvent<TimerStateChangeEventDetail> {
  constructor(detail: TimerStateChangeEventDetail) {
    super('stateChange', { detail });
  }
}

export class TimerPenaltyEvent extends CustomEvent<TimerPenaltyEventDetail> {
  constructor(detail: TimerPenaltyEventDetail) {
    super('penalty', { detail });
  }
}

export class TimerStopEvent extends CustomEvent<TimerStopEventDetail> {
  constructor(detail: TimerStopEventDetail) {
    super('stop', { detail });
  }
}
