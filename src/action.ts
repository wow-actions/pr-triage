import * as core from '@actions/core'
import * as github from '@actions/github'
import { Core } from './core'
import { Octokit } from './octokit'
import { getPRFromWorkflow } from './dummy'

export function isValidEvent(event: string, action?: string) {
  const { context } = github
  const { payload } = context
  if (event === context.eventName) {
    return action == null || action === payload.action
  }
  return false
}

export async function run() {
  try {
    core.info(
      `event: ${github.context.eventName}, action: ${github.context.payload.action}`,
    )

    if (
      isValidEvent('workflow_run') ||
      isValidEvent('pull_request', 'opened') ||
      isValidEvent('pull_request', 'closed') ||
      isValidEvent('pull_request', 'edited') ||
      isValidEvent('pull_request', 'reopened') ||
      isValidEvent('pull_request', 'synchronize') ||
      isValidEvent('pull_request', 'ready_for_review') ||
      isValidEvent('pull_request_target', 'opened') ||
      isValidEvent('pull_request_target', 'closed') ||
      isValidEvent('pull_request_target', 'edited') ||
      isValidEvent('pull_request_target', 'reopened') ||
      isValidEvent('pull_request_target', 'synchronize') ||
      isValidEvent('pull_request_target', 'ready_for_review')
    ) {
      const octokit = Octokit.get()
      const pr =
        github.context.eventName === 'workflow_run'
          ? await getPRFromWorkflow(octokit)
          : github.context.payload.pull_request!

      await Core.ensureLabels(octokit)
      const state = await Core.getState(octokit, pr as any)
      if (state) {
        Core.updateLabel(octokit, state, pr as any)
      } else {
        throw new Error('Undefined state')
      }
    }
  } catch (e) {
    core.setFailed(e)
  }
}
