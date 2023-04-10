# urql-wrapper

A wrapper for urql that enables more type-safe and semantic data handlings.

## Getting started

TBD

## Problems of default urql useQuery implementation

### Code readability

urql `useQuery` returns values as below:

```ts
// urql 4.0.0
type UseQueryResponse<
  Data = any,
  Variables extends AnyVariables = AnyVariables
> = [UseQueryState<Data, Variables>, UseQueryExecute];

interface UseQueryState<
  Data = any,
  Variables extends AnyVariables = AnyVariables
> {
  fetching: boolean;
  stale: boolean;
  data?: Data;
  error?: CombinedError;
  extensions?: Record<string, any>;
  operation?: Operation<Data, Variables>;
}
```

This is good enough but it could be improved to enhance its readability.

For instance, it's unclear what the status is when both `error` and `data` have a value, or whether such a state can exist.

The primary concerns when fetching data are whether the data is currently being fetched, whether the data was successfully fetched, or whether it failed and why.

If it is the initial data fetching, it should be obvious that the data is not yet available. When fetching is successful, the data should be available.
With urql-wrapper's useQuery, these simple principles are already implemented, allowing you to write type-safe and easy-to-read code, as demonstrated below."

```tsx
import {useQuery} from 'urql-wrapper';

function UserListContainer() {
  const query = useQuery({
    query: gql`
      query UserList {
        users {
          id
          name
        }
      }
    `,
  });

  switch (query.status) {
    case 'paused':
    case 'fetching':
      // you can't access to query.data as fetching is not yet finished.
      return <UserList isLoading />;
    case 'success': {
      // you can now access to query.data.
      return <UserList users={query.data.users} />;
    }
    case 'error':
      return <ErrorText />;
  }
}
```

With the default useQuery function provided by urql, the code for fetching data would look like this:

```tsx
import {useQuery} from 'urql';

function UserListContainer() {
  const [{ data, fetching, error }] = useQuery({
    query: gql`
      query UserList {
        users {
          id
          name
        }
      }
    `,
  });

  if (fetching) {
    return <UserList isLoading />
  }

  if (error) {
    return <ErrorText />
  }

  if (!data) {
    // If the data is optional, it's unclear what should be done in this case
  }

  return <UserList users={data.users}>
}
```

Here, the code fetches data using the useQuery function and checks for three possible states: if data is being fetched, if there is an error, and if data is missing. However, if the data is optional, it is not clear what should be done in that case.

### Data handling

It is common to obtain entities in GraphQL using node(id:). Suppose we have two entities, Company and User, which can be accessed via node(id:).

```gql
query SomeQuery {
  company: node(id: $companyId) {
    ... on Company {
      name
    }
  }

  user: node(id: $userId) {
    ... on User {
      age
    }
  }
}
```
If you want to obtain the Company with ID 1, you can write the following code:

```tsx
function CompanyContainer() {
    const [{ data, fetching, error }] = useQuery({
        query: gql`
            query Company($companyId: ID!) {
                company: node(id: $companyId) {
                    __typename
                    ... on Company {
                        name
                    }
                }
            }
        `,
        variables: {
            companyId: "1"
        }
    })

    if (fetching) {
        return <Company isLoading />
    }

    if (error) {
        return <ErrorText />
    }

    if (!data || data.__typename !== "Company") {
        // This code is basically unreachable, but we want to handle it as an error
        return <ErrorText />
    }

    // At this point, data is resolved to the Company object
    return <Company name={data.name}>
}
```

With urql-wrapper, you can transform and shape the raw GraphQL response using a selector as follows:

```tsx
function CompanyContainer() {
  const query = useQuery({
    query: gql`
      query Company($companyId: ID!) {
        company: node(id: $companyId) {
          __typename
          ... on Company {
            name
          }
        }
      }
    `,
    variables: {
      companyId: '1',
    },
    selector: data => {
      // Throw an error, which can be accessed via query.error
      if (!data || data.__typename !== 'Company') {
        throw new Error();
      }

      return data.company;
    },
  });

  switch (query.status) {
    case 'paused':
    case 'fetcing':
      return <Company isLoading />;
    case 'success':
      return <Company name={query.data.company.name} />;
    case 'error':
      return <ErrorText />;
  }
}
```

This code is more straightforward, isn't it?

### Sharing fetched data across multiple components.
It is now common to use the [Container Presentational design pattern](https://www.patterns.dev/posts/presentational-container-pattern) to separate concerns and write multiple container components that share the same query.

With urql's default implementation, you can easily achieve this by using useQuery with the cache-and-network request policy, which caches the data and returns it for the second query.

If you want to avoid caching the data, you need to specify the requestPolicy with network-only. In this case, you can use React Context to share data across multiple components. To avoid writing almost the same code multiple times, you can use the context factory queryProviderFactory.

Here's an example code:

```tsx
export const [AboutPageQueryProvider, useAboutPageQuery] = queryProviderFactory(
  {
    query: gql`
      query CompanyListPage {
        company {
          name
          users {
            id
            name
            age
          }
        }
      }
    `,
    selector: data => {
      // You can write selector here
    },
    requestPolicy: 'network-only',
  }
);

function AboutPage() {
  return (
    <AboutPageQueryProvider variables={'pass some data as you want'}>
      <CompanyDetailContainer />
      <UserListContainer />
    </AboutPageQueryProvider>
  );
}
```
