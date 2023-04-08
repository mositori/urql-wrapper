import {useCallback, useMemo} from 'react';

import {useQuery} from 'urql';

import type {TypedDocumentNode, AnyVariables, RequestPolicy} from 'urql';

export type PausedResult = {
  status: 'paused';
  data: undefined;
};

const PausedResult = (): PausedResult => ({
  status: 'paused',
  data: undefined,
});

export type FetchingResult = {
  status: 'fetching';
  data: undefined;
};

const FetchingResult = (): FetchingResult => ({
  status: 'fetching',
  data: undefined,
});

export type SuccessResult<SelectedData> = {
  status: 'success';
  data: SelectedData;
};

export const SuccessResult = <SelectedData>(
  data: SelectedData
): SuccessResult<SelectedData> => ({
  status: 'success',
  data,
});

export type ErrorResult = {
  status: 'error';
  data: undefined;
  error: SelectorError | NoDataError;
};

export const ErrorResult = (
  error: SelectorError | NoDataError
): ErrorResult => ({
  status: 'error',
  data: undefined,
  error,
});

export type QueryResult<SelectedData> =
  | PausedResult
  | FetchingResult
  | SuccessResult<SelectedData>
  | ErrorResult;

export interface UseAppQueryReturn<Result, Data> {
  result: Result;
  refetch: () => void;

  /**
   * @internal for useRetryableQuery only
   */
  __rawValue?: Data;
}

export const useAppQuery = <Data, Variables extends AnyVariables, SelectedData>(
  props: UseAppQueryProps<Data, Variables, SelectedData>
): UseAppQueryReturn<QueryResult<SelectedData>, Data> => {
  const [{data, fetching, error}, _refetch] = useQuery<Data, Variables>({
    query: props.query,
    variables: props.variables,
    pause: props.paused,
    context: useMemo(
      () => ({
        requestPolicy: props.requestPolicy,
        suspense: false,
      }),
      [props.requestPolicy]
    ),
  });

  const refetch = useCallback(() => {
    _refetch({
      requestPolicy: 'network-only',
    });
  }, [_refetch]);

  const resultWrapper = <T>(result: T): UseAppQueryReturn<T, Data> => ({
    result,
    refetch,
    __rawValue: data,
  });

  if (props.paused) {
    return resultWrapper(PausedResult());
  }

  if (fetching) {
    return resultWrapper(FetchingResult());
  }

  if (error) {
    return resultWrapper(ErrorResult(error));
  }

  if (!data) {
    return resultWrapper(ErrorResult(new NoDataError()));
  }

  try {
    return resultWrapper(SuccessResult(props.selector(data)));
  } catch (error) {
    if (error instanceof Error) {
      return resultWrapper(ErrorResult(new SelectorError(error)));
    }

    return resultWrapper(ErrorResult(new SelectorError()));
  }
};

class SelectorError extends Error {
  constructor(error?: Error) {
    super('[Query] Query selector threw an error. See cause for more details.');
    super.cause = error;
  }
}

class NoDataError extends Error {
  constructor() {
    super('[Query] Query returned no data.');
  }
}

export interface UseAppQueryProps<
  Data,
  Variables extends AnyVariables,
  SelectedData
> {
  query: TypedDocumentNode<Data, Variables>;
  variables: Variables;
  selector: (data: Data) => SelectedData;
  paused?: boolean;
  requestPolicy?: RequestPolicy;
}
