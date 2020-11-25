export namespace Config {
  export const defaults = {
    wipRegex: /^\s*(\[WIP\]\s*|WIP:\s*|WIP\s+)+\s*/i,
    labels: {
      draft: {
        name: 'PR: draft',
        color: 'eeeeee',
        description: 'PR is draft.',
      },
      unreviewed: {
        name: 'PR: unreviewed',
        color: 'fbca04',
        description: 'PR does not have any reviews.',
      },
      approved: {
        name: 'PR: reviewed-approved',
        color: '0e8a16',
        description:
          'PR has reviewd and got Approve from one of the reviewers.',
      },
      partiallyApproved: {
        name: 'PR: partially-approved',
        color: 'c2e2a2',
        description:
          'PR has reviewd and got Approve from one of the reviewers.',
      },
      changesRequested: {
        name: 'PR: reviewed-changes-requested',
        color: 'fbca04',
        description: 'PR has reviewed and got Change request event.',
      },
      merged: {
        name: 'PR: merged',
        color: '662daf',
        description: 'PR has merged.',
      },
    },
  }

  export type Label = keyof typeof defaults.labels

  export type State = Label | undefined | 'wip'
}
