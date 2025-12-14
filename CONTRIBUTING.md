# CONTRIBUTING

First off, thank you for considering contributing to our project. We value all our contributors and the insights they bring to the table.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Coding Guidelines](#coding-guidelines)
  - [Clean Architecture Rules](#clean-architecture-rules)
  - [Type-Safe Programming](#type-safe-programming)
- [Writing Tests](#writing-tests)
- [How to Submit Changes](#how-to-submit-changes)
- [Recognition](#recognition)
- [Getting Help](#getting-help)

## Code of Conduct

We expect everyone participating in this project to adhere to our Code of Conduct. Below are the main points, but we encourage you to read the full Code of Conduct.

- Treat everyone with respect.
- Avoid making assumptions about other people's identities and experiences.
- Keep criticism constructive and respectful.
- Report any incidents of harassment or inappropriate behavior to the project maintainers.

## Coding Guidelines

### Clean Architecture Rules

Our project follows the principles of Clean Architecture. This means that we separate concerns, make the project independent of any frameworks, and make it testable and independent of the UI.

In addition, our domain layer should not depend on the adapter layer. Please ensure that any contributions you make maintain this separation and adhere to these principles.

### Type-Safe Programming

We aim for a type-safe programming style, so please avoid using `any` or `as`. Instead, use type guards or other means to determine types.

### Code Style

- As a general rule, please refrain from writing comments whenever possible.
  - Your first approach should be to make your variable and function names as descriptive and self-explanatory as possible.
  - Only when this is not sufficient, and the functionality or purpose of the code is not immediately clear, should comments be used.
- We encourage the use of the arrow function style as much as possible. It offers a more concise syntax and aligns with contemporary JavaScript practices. Please favor this style when contributing to our codebase.

## Writing Tests

Testing is a crucial part of our development process. We expect all code contributions to be accompanied by corresponding tests. This helps us maintain the quality of the project and catch any potential issues early.

### Unit Test Template

```
import { ReplaceAllWords } from './ReplaceAllWords';
import { FileRepository } from './adapter-interfaces/FileRepository';
import { StringConvertor } from './adapter-interfaces/StringConvertor';
type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>

describe('ReplaceAllWords', () => {

  beforeEach(() => {
   jest.resetAllMocks();
  });

  const createUseCaseAndMockRepositories = ()=>{
    const  fileRepository: Mocked<FileRepository> = {
      readdirSync: jest.fn(),
      renameSync: jest.fn(),
      lstatSync: jest.fn(),
      statSync: jest.fn(),
      readFileSync: jest.fn(),
      writeFileSync: jest.fn(),
    };

    const stringConvertor: Mocked<StringConvertor> = {
      camelCase: jest.fn(),
      snakeCase: jest.fn(),
      pascalCase: jest.fn(),
      kebabCase: jest.fn(),
      screamSnakeCase: jest.fn(),
    };

    const  useCase: ReplaceAllWords =  new ReplaceAllWords(fileRepository, stringConvertor);
    return  {
      fileRepository,
      stringConvertor,
      useCase
    }
  }
});

```

## How to Submit Changes

Once you've identified a bug or an enhancement you'd like to work on, follow these steps to make and submit your changes:

1. Fork the repository.
2. Create a new branch.
3. Make your changes, ensuring you follow our coding conventions and style guide.
4. Write tests for your changes.
5. Submit a pull request.

Please note that we may take a while to respond, but we appreciate your patience. We aim to make the contribution process as transparent as possible and will keep you updated every step of the way.

## Getting Help

If you need help or have any questions, please create an issue in the project's GitHub repository. We aim to respond to issues promptly and appreciate your patience.

Again, thank you for considering contributing to our project. Your input is valuable, and we look forward to working with you.
