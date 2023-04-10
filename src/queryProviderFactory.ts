import constate from 'constate';

import {useQuery} from './useQuery';

import type {AnyVariables, RequestPolicy, TypedDocumentNode} from 'urql';

interface QueryProviderFactoryProps<Data, Variables, Output> {
  query: TypedDocumentNode<Data, Variables>;
  selector: (data: Data) => Output;
  requestPolicy: RequestPolicy;
}

export interface QueryProviderProps<Variables> {
  variables: Variables;
  paused?: boolean;
}

export const queryProviderFactory = <
  Data,
  Variables extends AnyVariables,
  Output
>(
  factoryInput: QueryProviderFactoryProps<Data, Variables, Output>
) =>
  constate((input: QueryProviderProps<Variables>) =>
    useQuery<Data, Variables, Output>({
      query: factoryInput.query,
      variables: input.variables,
      selector: factoryInput.selector,
      paused: input.paused,
      requestPolicy: factoryInput.requestPolicy,
    })
  );
