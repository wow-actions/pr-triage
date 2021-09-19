import * as core from '@actions/core'
import * as github from '@actions/github'

function getToken() {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    const message = 'github token must be defined'
    core.setFailed(message)
    throw message
  }

  try {
    github.getOctokit(token)
  } catch (err) {
    const message = 'token provided failed to initialize octokit'
    core.setFailed(message)
    throw message
  }

  return token
}

function getWorkflowId() {
  const id = process.env.WORKFLOW_ID

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

function getOctokit() {
  const token = getToken()
  const octokit = github.getOctokit(token)

  if (!octokit) {
    const message = 'something went wrong when instantiating octokit'
    core.setFailed(message)
    throw message
  }

  return octokit
}

async function getPR(prNum: number) {
  const octokit = getOctokit()

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

async function getPRFromSha(sha: string) {
  // Finds Pull request for this workflow run
  core.info(
    `\nFinding PR request id for: owner: ${github.context.repo.owner}, Repo: ${github.context.repo.repo}.\n`,
  )

  const octokit = getOctokit()
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
  return getPR(prNum)
}

async function getHeadSha() {
  const id = getWorkflowId()
  const octokit = getOctokit()

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

function checkWorkflowRun() {
  if (github.context.eventName !== 'workflow_run') {
    const message = [
      'this action requires that it be a side-effect run within a workflow_run;',
      'this is because the standard event triggers are not able to access this',
      'action outside of the scope of a workflow_run which is always in-scope',
      'with the main repository',
    ].join(' ')
    core.setFailed(message)
    throw message
  }
  return true
}

export async function requirePRFromWorkflowRun() {
  checkWorkflowRun()
  const sha = await getHeadSha()
  return getPRFromSha(sha)
}
