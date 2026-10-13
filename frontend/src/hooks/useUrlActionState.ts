import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface UseUrlActionStateOptions<TAction extends string = string> {
  actionParam?: string;
  entityIdParam?: string;
  additionalParamsToClear?: string[];
}

export function useUrlActionState<TAction extends string = string>(
  options: UseUrlActionStateOptions<TAction> = {}
) {
  const { actionParam = 'action', entityIdParam = 'productId', additionalParamsToClear = [] } = options;
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = React.useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const activeAction = (searchParams.get(actionParam) as TAction | null) || null;
  const activeEntityId = searchParams.get(entityIdParam) || null;

  const openAction = React.useCallback(
    (action: TAction, entityId?: string | null, extraParams?: Record<string, string | undefined>) => {
      const nextParams = new URLSearchParams(location.search);
      nextParams.set(actionParam, action);
      if (entityId) {
        nextParams.set(entityIdParam, entityId);
      } else {
        nextParams.delete(entityIdParam);
      }
      if (extraParams) {
        Object.entries(extraParams).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') {
            nextParams.set(k, v);
          } else {
            nextParams.delete(k);
          }
        });
      }
      navigate(
        {
          pathname: location.pathname,
          search: nextParams.toString() ? `?${nextParams.toString()}` : '',
        },
        { replace: true }
      );
    },
    [actionParam, entityIdParam, location.pathname, location.search, navigate]
  );

  const closeAction = React.useCallback(() => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete(actionParam);
    nextParams.delete(entityIdParam);
    additionalParamsToClear.forEach((p) => nextParams.delete(p));

    navigate(
      {
        pathname: location.pathname,
        search: nextParams.toString() ? `?${nextParams.toString()}` : '',
      },
      { replace: true }
    );
  }, [actionParam, entityIdParam, additionalParamsToClear, location.pathname, location.search, navigate]);

  const isAction = React.useCallback(
    (action: TAction) => activeAction === action,
    [activeAction]
  );

  return {
    activeAction,
    activeEntityId,
    openAction,
    closeAction,
    isAction,
    searchParams,
  };
}
