export namespace Config {
  export const defaults = {
    wipRegex: /^\s*(\[WIP\]\s*|WIP:\s*|WIP\s+)+\s*/i,
    labels: {
      draft: {
        name: 'PR: draft',
        color: 'eeeeee',
      },
      unreviewed: {
        name: 'PR: unreviewed',
        color: 'fbca04',
      },
      approved: {
        name: 'PR: reviewed-approved',
        color: '0e8a16',
      },
      partiallyApproved: {
        name: 'PR: partially-approved',
        color: 'c2e2a2',
      },
      changesRequested: {
        name: 'PR: reviewed-changes-requested',
        color: 'fbca04',
      },
      merged: {
        name: 'PR: merged',
        color: '662daf',
      },
    },
  }

  export type Label = keyof typeof defaults.labels

  export type State = Label | undefined | 'wip'
}
