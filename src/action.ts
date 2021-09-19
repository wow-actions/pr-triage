import * as core from '@actions/core'
import * as github from '@actions/github'
import { Util } from './util'
import { Octokit } from './octokit'

export async function run() {
  try {
    core.info(
      `event: ${github.context.eventName}, action: ${github.context.payload.action}`,
    )
    if (
      Util.isValidEvent('pull_request', 'opened') ||
      Util.isValidEvent('pull_request', 'closed') ||
      Util.isValidEvent('pull_request', 'edited') ||
      Util.isValidEvent('pull_request', 'reopened') ||
      Util.isValidEvent('pull_request', 'synchronize') ||
      Util.isValidEvent('pull_request', 'ready_for_review') ||
      Util.isValidEvent('pull_request_target', 'opened') ||
      Util.isValidEvent('pull_request_target', 'closed') ||
      Util.isValidEvent('pull_request_target', 'edited') ||
      Util.isValidEvent('pull_request_target', 'reopened') ||
      Util.isValidEvent('pull_request_target', 'synchronize') ||
      Util.isValidEvent('pull_request_target', 'ready_for_review') ||
      Util.isValidEvent('pull_request_review', 'submitted') ||
      Util.isValidEvent('pull_request_review', 'dismissed')
    ) {
      const octokit = Octokit.get()
      await Util.ensureLabels(octokit)
      const state = await Util.getState(octokit)
      if (state) {
        Util.updateLabel(octokit, state)
      } else {
        throw new Error('Undefined state')
      }
    }
  } catch (e) {
    core.error(e)
    core.setFailed(e.message)
  }
}
