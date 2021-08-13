# Recipe Scraper

## Prompt

I eat a low carb diet. I also like like to body-build. You're going to help me find something to
eat.

Your job is to use the recipe site http://www.genaw.com/lowcarb/recipes.html to search for a
particular recipe. This website does not provide an API, so you will need to devise an automated way
to search through the pages.

The recipe I am looking for is the one with the greatest ratio of protein to net carbs. But I have
discerning taste, so make sure it has at least a 5 star rating.

To recap:

    Find a way to get all 5 star recipes from the site.

    Select the recipe with the greatest protein for the lowest net carbs.

    Tell me the name of the recipe, the URL, and the nutrition information.

## Setup

One time setup:

1. Verify that you have `nvm` installed in your device: `nvm ls`. If not,
   [follow these steps](https://github.com/nvm-sh/nvm#installing-and-updating)
2. Clone & `cd` into the repo
3. Use the project version of Node: `nvm use`.
   [For more information about releases](https://nodejs.org/en/about/releases/)
4. `npm install`

## Running the application

To run the application use the following:

```sh
npm start
# or
node index.js
```

### Scraping

If you have not yet scraped http://www.genaw.com/lowcarb/recipes.html it will be done during the
first invocation of the application. The current implementation utilizes
[Playwright](https://playwright.dev/) to spin up a headless browser to scrape for the information
required. This information will be saved to speed up future invocations.

Anytime you'd like to re-scrape the recipes, use the following before running again:

```sh
rm -rf recipes.json
```

**Note**: This process is time-consuming as it has to open up nearly 800 web pages with a browser to
scrape the information from each. If given more time, I'd have likely tried again by utilizing a
node-based HTML parser to avoid using an entire browser process.

## Running the tests

```sh
npm test
```

### Unit Tests

```sh
npm run test:unit
```

### Type-Checking

```sh
npm run typecheck
```

## Linting

### TypeScript

```sh
npm run lint:ts
```

### Markdown

```sh
npm run lint:md
```

## Architecture

After reading
[DDD Made Functional](https://pragprog.com/titles/swdddf/domain-modeling-made-functional/) and
practicing FP w/ DDD for multiple years, I've come to a system pretty similar to Clean Architecture,
but after working with some colleagues we've formalized the idea of a "composition" layer which
stitches together multiple bounded contexts w/ their relevant infrastructure implementations.

![Clean Architecture](./clean-architecture.png?raw=true)

Listed from "bottom" to the "top" the layers are as following

- Domain
  - Responsible for the core data contracts that represent our domain
  - Used as a shared abstraction between the application + infrastructure layer
  - Usually types, sometimes some constructors or predicates/refinements
- Application
  - Responsible for algorithms and logic
  - Unit-Tested
  - Utilizes
    [Dependency Inversion](https://javascript.plainenglish.io/decoupling-code-in-javascript-with-the-dependency-inversion-principle-6d23342b4aaa)
    to lift side-effects away from the core logic, deferring such choices to the Infrastructure
- Infrastructure
  - Responsible for all side-effects, HTTP, persistence, etc
  - Unit or Integration Tested
  - Environment-aware
- Composition
  - Responsible for composing the other layers into a running whole.
  - Integration/Functional testing

This architecture accounts for its separation of concerns rigorously, which lends itself to testing
and maintenance.
