import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  sanitizeQueryParams,
  sanitizeParamValue,
  validateParamWithWhitelist,
  validateEntityId,
} from '../lib/api/url-params';

export interface UseUrlActionStateOptions<TAction extends string = string> {
  actionParam?: string;
  entityIdParam?: string;
  additionalParamsToClear?: string[];
  allowedActions?: readonly TAction[];
  entityIdPattern?: RegExp;
}

export function useUrlActionState<TAction extends string = string>(
  options: UseUrlActionStateOptions<TAction> = {}
) {
  const {
    actionParam = 'action',
    entityIdParam = 'productId',
    additionalParamsToClear = [],
    allowedActions,
    entityIdPattern,
  } = options;
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = React.useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const activeAction = React.useMemo(() => {
    const rawAction = searchParams.get(actionParam);
    if (!rawAction) return null;
    if (allowedActions) {
      return validateParamWithWhitelist(rawAction, allowedActions);
    }
    return (sanitizeParamValue(rawAction) as TAction | null) || null;
  }, [searchParams, actionParam, allowedActions]);

  const activeEntityId = React.useMemo(() => {
    const rawEntityId = searchParams.get(entityIdParam);
    if (!rawEntityId) return null;
    return validateEntityId(rawEntityId, entityIdPattern);
  }, [searchParams, entityIdParam, entityIdPattern]);

  const openAction = React.useCallback(
    (action: TAction, entityId?: string | null, extraParams?: Record<string, string | undefined>) => {
      // Validate action if allowedActions whitelist is configured
      if (allowedActions && !allowedActions.includes(action)) {
        return;
      }

      const nextParams = new URLSearchParams(location.search);
      nextParams.set(actionParam, action);

      if (entityId) {
        const validatedId = validateEntityId(entityId, entityIdPattern);
        if (validatedId) {
          nextParams.set(entityIdParam, validatedId);
        } else {
          nextParams.delete(entityIdParam);
        }
      } else {
        nextParams.delete(entityIdParam);
      }

      if (extraParams) {
        // Sanitize extra parameters against prototype pollution, HPP, and control chars
        const sanitized = sanitizeQueryParams(extraParams);
        // Remove existing keys in extraParams if value was omitted/empty in extraParams
        Object.keys(extraParams).forEach((k) => {
          if (!sanitized[k]) {
            nextParams.delete(k);
          }
        });
        // Set sanitized keys
        Object.entries(sanitized).forEach(([k, v]) => {
          nextParams.set(k, v);
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
    [actionParam, entityIdParam, entityIdPattern, allowedActions, location.pathname, location.search, navigate]
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
