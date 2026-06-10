# Releasing

Releases are created from `main` after a release-prep PR is merged.

Do not manually create or push release tags from the command line for normal
releases. Use the `Release` GitHub Actions workflow.

The release workflow does not bump versions or commit changes to `main`.
Version bumps must happen through a normal release-prep branch and PR before
the release workflow is run.

## 1. Create a release branch

```sh
git switch main
git pull
git switch -c release/v0.3.1
```

## 2. Bump the package version

```sh
npm version 0.3.1 --no-git-tag-version
```

This updates both:

- `package.json`
- `package-lock.json`

Confirm both files contain the exact version being released.

## 3. Run tests

```sh
npm test
```

## 4. Update docs if needed

Update README examples, install instructions, or release-related documentation
if they reference the previous version.

## 5. Commit and open a PR

```sh
git add package.json package-lock.json README.md docs/releasing.md
git commit -m "Prepare release v0.3.1"
git push -u origin release/v0.3.1
```

Open a PR into `main`.

## 6. Merge the PR

After review and passing tests, merge the PR.

## 7. Run the release workflow

In GitHub:

1. Go to **Actions**.
2. Select **Release**.
3. Click **Run workflow**.
4. Select the `main` branch.
5. Enter the version without the `v` prefix, for example `0.3.1`.
6. Choose whether this is a prerelease.
7. Run the workflow.

The workflow will:

- Install dependencies.
- Run `npm test`.
- Confirm it is running from `main`.
- Confirm `package.json` and `package-lock.json` match the requested version.
- Confirm the release tag does not already exist.
- Create an annotated tag named `v<version>`.
- Push the tag.
- Create a GitHub Release with generated notes.

## Troubleshooting

If the workflow fails because the package versions do not match, create a
release-prep PR that updates both `package.json` and `package-lock.json`.

If the workflow fails because the tag already exists, do not overwrite the tag.
Investigate whether the release already happened or whether the tag was created
manually by mistake.
