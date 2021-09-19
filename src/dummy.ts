import * as core from '@actions/core'
import * as github from '@actions/github'
import { Octokit } from './octokit'

function getWorkflowId() {
  const id = core.getInput('WORKFLOW_ID')

  if (!id) {
    const message = 'no workflow id was given, but a workflow id is required'
    core.setFailed(message)
    throw message
  }

  if (typeof id === 'string') {
    return parseInt(id, 16)
  }

  if (typeof id === 'number') {
    return id
  }

  const message =
    'provided workflow id is neither a stringified number or a number'
  core.setFailed(message)
  throw message
}

async function getPRbyID(prNum: number, octokit: Octokit) {
  const { data: pr } = await octokit.rest.pulls.get({
    ...github.context.repo,
    pull_number: prNum,
  })

  if (!pr) {
    const message = `PR ${prNum} was not found to be associated with a real pull request`
    core.setFailed(message)
    throw message
  }

  if (pr.merged) {
    const message = `PR ${prNum} is already merged; quitting...`
    core.setFailed(message)
    throw message
  }

  return pr
}

async function getPRBySha(sha: string, octokit: Octokit) {
  // Finds Pull request for this workflow run
  core.debug(
    `\nFinding PR request id for: owner: ${github.context.repo.owner}, Repo: ${github.context.repo.repo}.\n`,
  )

  const prs = await octokit.rest.search
    .issuesAndPullRequests({
      q: `q=${[
        `sha:${sha}`, // retrieves pull request with this sha
        `is:pr`, // will only retrieve pull requests and not issues
        `is:open`, // will only retrive pull requests that are open
        `repo:${github.context.repo.owner}/${github.context.repo.repo}`, // only considers PRs of the repo in context
      ].join('+')}`,
    })
    .then((res) => res.data)

  if (prs.total_count === 0) {
    const message = [
      `no pull request was found to be both open and associated with the provided sha of ${sha}`,
      `make sure that the WORKFLOW-ID provided is from github.event.workflow_run.id (the triggering`,
      `event's workflow id)`,
    ].join(' ')
    core.setFailed(message)
    throw message
  }

  if (prs.total_count > 1) {
    const message = [
      `more than one pull request was found to be both open and associated`,
      `with the provided sha of ${sha}; this action is not currently able`,
      `to deal with this edge-case; please reach out to the maintainers`,
      `if you believe this is in error`,
    ].join(' ')
    core.setFailed(message)
    throw message
  }

  // provided the above assertions, this number is guaranteed to be defined
  const prNum = prs.items[0]?.number
  return getPRbyID(prNum, octokit)
}

async function getHeadSha(octokit: Octokit) {
  const id = getWorkflowId()
  const source = await octokit.rest.actions
    .getWorkflowRun({
      ...github.context.repo,
      run_id: id,
    })
    .then((res) => res.data)
    .catch((err) => {
      core.setFailed(err)
      throw err
    })

  if (!source.head_sha) {
    const message = `workflow run found from workflow run id ${id} did not contain a head sha`
    core.setFailed(message)
    core.debug(JSON.stringify(source))
    throw message
  }

  return source.head_sha
}

export async function getPRFromWorkflow(octokit: Octokit) {
  const sha = await getHeadSha(octokit)
  return getPRBySha(sha, octokit)
}
