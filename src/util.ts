import * as core from '@actions/core'
import * as github from '@actions/github'
import { Config } from './config'

export namespace Util {
  type Octokit = ReturnType<typeof getOctokit>

  export function getOctokit() {
    const token = core.getInput('GITHUB_TOKEN', { required: true })
    return github.getOctokit(token)
  }

  export function isValidEvent(event: string, action?: string) {
    const context = github.context
    const payload = context.payload
    if (event === context.eventName) {
      return action == null || action === payload.action
    }
    return false
  }

  export async function ensureLabels(octokit: Octokit) {
    const labels = Object.values(Config.defaults.labels)
    return Promise.all(
      labels.map(async ({ name, color, description }) => {
        return octokit.issues
          .getLabel({
            ...github.context.repo,
            name,
          })
          .catch(() => {
            return octokit.issues.createLabel({
              ...github.context.repo,
              name,
              color,
              description,
            })
          })
      }),
    )
  }

  function getPullRequest() {
    const context = github.context
    return (context.payload.pull_request ||
      context.payload.review.pull_request) as Exclude<
      typeof context.payload.pull_request,
      undefined
    >
  }

  async function getReviews(octokit: Octokit) {
    const pr = getPullRequest()
    // Ignore inconsitent variable name conversation
    // because of https://octokit.github.io/rest.js/v17#pulls-list-reviews
    return octokit.pulls
      .listReviews({ ...github.context.repo, pull_number: pr.number })
      .then((res) => res.data || [])
  }

  async function getUniqueReviews(octokit: Octokit) {
    const reviews = await getReviews(octokit)
    const pr = getPullRequest()
    const sha = pr.head.sha
    const uniqueReviews = reviews
      .filter((review) => review.commit_id === sha)
      .filter(
        (review) =>
          review.state === 'APPROVED' || review.state === 'CHANGES_REQUESTED',
      )
      .reduce<{ [id: number]: { state: string; submitted_at: string } }>(
        (memo, review) => {
          if (memo[review.user.id] == null) {
            memo[review.user.id] = {
              state: review.state,
              submitted_at: review.submitted_at,
            }
          } else {
            const a = new Date(memo[review.user.id]['submitted_at']).getTime()
            const b = new Date(review.submitted_at).getTime()
            if (a < b) {
              memo[review.user.id] = {
                state: review.state,
                submitted_at: review.submitted_at,
              }
            }
          }
          return memo
        },
        {},
      )

    return Object.values(uniqueReviews)
  }

  /**
   * Get the required number of reviews according to branch protections
   * @return {Promise<number>} The number of required approving reviews,
   * or `1` if Administration Permission is not granted or Branch Protection
   * is not set up.
   */
  async function getRequiredNumberOfReviews(octokit: Octokit): Promise<number> {
    const pr = getPullRequest()
    return await octokit.repos
      // See: https://developer.github.com/v3/previews/#require-multiple-approving-reviews
      .getBranchProtection({
        ...github.context.repo,
        branch: pr.base.ref,
        mediaType: {
          previews: ['luke-cage'],
        },
      })
      .then(({ data }) => {
        // If the Branch protection rule is configure but the Requrie pull
        // request review before mergning is not set, it does not have
        // `required_pull_request_reviews` property
        if (!data.hasOwnProperty('required_pull_request_reviews')) {
          throw new Error('Required reviews not configured error')
        }

        return (
          data.required_pull_request_reviews.required_approving_review_count ||
          1
        )
      })
      .catch((err) => {
        // Return the minium number of reviews if it's 403 or 403 because
        // Administration Permission is not granted (403) or Branch Protection
        // is not set up(404).
        if (
          err.status === 404 ||
          err.status === 403 ||
          err.message === 'Required reviews not configured error'
        ) {
          return 1
        }
        throw err
      })
  }

  /**
   * Get the number of users/teams that have been requested to review the PR
   */
  async function getRequestedNumberOfReviews(octokit: Octokit) {
    const pr = getPullRequest()
    return octokit.pulls
      .listRequestedReviewers({
        ...github.context.repo,
        pull_number: pr.number,
      })
      .then((res) => res.data.teams.length + res.data.users.length)
  }

  export async function getState(octokit: Octokit): Promise<Config.State> {
    const pr = getPullRequest()

    if (pr.draft) {
      return 'draft'
    }

    if (pr.title.match(Config.defaults.wipRegex)) {
      return 'wip'
    }

    if (pr.state === 'closed' && pr.merged) {
      return 'merged'
    }

    const reviews = await getUniqueReviews(octokit)
    const requiredNumberOfReviews = await getRequiredNumberOfReviews(octokit)
    const numRequestedReviewsRemaining = await getRequestedNumberOfReviews(
      octokit,
    )

    if (reviews.length === 0) {
      return 'unreviewed'
    }

    const changeRequestedReviews = reviews.filter(
      (review) => review.state === 'CHANGES_REQUESTED',
    )
    const approvedReviews = reviews.filter(
      (review) => review.state === 'APPROVED',
    )

    if (changeRequestedReviews.length > 0) {
      return 'changesRequested'
    }

    if (
      approvedReviews.length < requiredNumberOfReviews ||
      numRequestedReviewsRemaining > 0
    ) {
      // Mark if partially approved if:
      // 1) Branch protections require more approvals
      //  - or -
      // 2) not everyone requested has approved (requested remaining > 0)
      return 'partiallyApproved'
    }

    if (reviews.length === approvedReviews.length) {
      return 'approved'
    }
  }

  export async function updateLabel(
    octokit: Octokit,
    currentState: Config.State,
  ) {
    const previousState = getPreviousState()
    core.info(`previous state: ${previousState}`)
    core.info(`current state: ${currentState}`)
    if (previousState) {
      if (currentState === 'wip') {
        await removeLabelByState(octokit, previousState as Config.Label)
      } else if (previousState !== currentState) {
        await removeLabelByState(octokit, previousState as Config.Label)
        await addLabelByState(octokit, currentState as Config.Label)
      }
    } else {
      if (currentState !== 'wip') {
        await addLabelByState(octokit, currentState as Config.Label)
      }
    }
  }

  function getPreviousState(): Config.Label | undefined {
    const presets = Config.defaults.labels
    const states = Object.keys(presets).reduce<{ [label: string]: string }>(
      (memo, state: Config.Label) => {
        memo[presets[state].name] = state
        return memo
      },
      {},
    )

    return getPullRequest()
      .labels.map((label: any) => {
        return label.name && states[label.name]
      })
      .filter((key: string) => key != null)[0]
  }

  async function removeLabelByState(octokit: Octokit, state: Config.Label) {
    core.info(`remove label by state: ${state}`)
    // TODO: scrects are not available in pull_request_review event in forked repo.
    return getLabelByState(state).then(
      (preset) => {
        if (preset) {
          const pr = getPullRequest()
          return octokit.issues.removeLabel({
            ...github.context.repo,
            issue_number: pr.number,
            name: preset.name,
          })
        }
      },
      () => {}, // Do nothing for error handling.
    )
  }

  async function addLabelByState(octokit: Octokit, state: Config.Label) {
    core.info(`add label by state: ${state}`)
    return getLabelByState(state).catch(() => {
      const pr = getPullRequest()
      const preset = Config.defaults.labels[state]
      return octokit.issues.addLabels({
        ...github.context.repo,
        issue_number: pr.number,
        labels: [preset.name],
      })
    })
  }

  async function getLabelByState(
    state: Config.Label,
  ): Promise<{ name: string; color: string; description: string }> {
    return new Promise((resolve, reject) => {
      const labels = getPullRequest().labels
      const preset = Config.defaults.labels[state]
      for (const label of labels) {
        if ((label.name = preset.name)) {
          resolve(preset)
        }
      }
      reject()
    })
  }
}
