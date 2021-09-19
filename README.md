# PR Triage

> Automatically labelling PR depending on the PR's status.

## Usage

Step 1. Create a `.github/workflows/pr-triage-dummy.yml` file in you repository.

> Github actions can not access secrets in `pull_request_review` event, so we need to create a dryrun workflow to triggers a `workflow_run`. Then we can process the event in Step 2.
>
> @see [How to use secret in pull_request_review similar to pull_request_target?](https://stackoverflow.com/questions/67247752/how-to-use-secret-in-pull-request-review-similar-to-pull-request-target)

```yml
name: PR Triage Dummy
on:
  pull_request_review:
    types: [submitted, dismissed]
jobs:
  dummy:
    runs-on: ubuntu-latest
    steps:
      - run: echo "this is a dummy workflow that triggers a workflow_run; it's necessary because otherwise the repo secrets will not be in scope for externally forked pull requests"
```

Step 2. Create a `.github/workflows/pr-triage.yml` file in you repository.

```yml
name: PR Triage
on:
  pull_request_target:
    types: [opened, closed, edited, reopened, synchronize, ready_for_review]
  workflow_run:
    workflows: ['PR Triage Dummy'] # the workflow in step 1
    types: [requested]
jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: wow-actions/pr-triage@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN  }}
          WORKFLOW-ID: ${{ github.event.workflow_run.id }}
```

## How it works

![workflow](screenshots/workflow.png)

Only watching the most recent commit :eyes::

- Do nothing when the PR's title starts from `WIP`, `[WIP]` or `WIP:`.
- Add the `PR: unreviewed` label when the PR does not have any reviews.
- Add the `PR: reviewed-changes-requested` label when the PR has reviewed and got `Change request` event.
- Add the `PR: review-approved` label when the PR has reviewed and got `Approve` event.

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
