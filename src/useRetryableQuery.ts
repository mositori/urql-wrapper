import {useEffect, useRef} from 'react';

import {wait} from './utils';

import {ErrorResult, useAppQuery} from './useQuery';

import type {UseAppQueryReturn, QueryResult} from './useQuery';
import type {AnyVariables, TypedDocumentNode} from 'urql';

type RetryingResult = {
  status: 'retrying';
  counts: number;
};

const RetryingResult = (counts: number): RetryingResult => ({
  status: 'retrying',
  counts,
});

export const useRetryableQuery = <
  Data,
  Variables extends AnyVariables,
  SelectedData
>(
  input: UseRetryableQueryProps<Data, Variables, SelectedData>
): UseRetryableQueryReturn<SelectedData, Data> => {
  const retryCounts = useRef(0);
  const shouldPause = input.pause || retryCounts.current >= input.maxRetryCount;
  const query = useAppQuery({
    query: input.query,
    variables: input.variables,
    paused: shouldPause,
    selector: input.selector,
    requestPolicy: 'network-only',
  });

  const shouldRetry = input.retryIf(query.__rawValue);

  useEffect(() => {
    if (shouldRetry !== true) return;
    if (query.result.status !== 'fetching') return;
    if (retryCounts.current >= input.maxRetryCount) return;

    const nextRetryCount = retryCounts.current + 1;
    const delay = input.retryDelay?.(nextRetryCount) ?? nextRetryCount * 1000;
    void wait(delay).then(() => {
      if (retryCounts.current >= input.maxRetryCount) return;
      retryCounts.current += 1;
      query.refetch();
    });
  }, [shouldRetry, query.result.status]);

  if (retryCounts.current >= input.maxRetryCount) {
    return {
      ...query,
      result: ErrorResult(new Error('Max retry count exceeded')),
    };
  }

  switch (shouldRetry) {
    case 'bail':
      return {
        ...query,
        result: ErrorResult(new Error('Bailed')),
      };
    case true: {
      return {
        ...query,
        result: RetryingResult(retryCounts.current),
      };
    }
    case false: {
      return query;
    }
  }
};

export interface UseRetryableQueryProps<
  Data,
  Variables extends AnyVariables,
  SelectedData
> {
  query: TypedDocumentNode<Data, Variables>;
  variables: Variables;
  pause?: boolean;
  selector: (data?: Data) => SelectedData;
  retryIf: (data?: Data) => boolean | 'bail';
  retryDelay?: (retryCount: number) => number;
  maxRetryCount: number;
}

export type UseRetryableQueryReturn<SelectedData, Data> = UseAppQueryReturn<
  QueryResult<SelectedData> | RetryingResult,
  Data
>;
