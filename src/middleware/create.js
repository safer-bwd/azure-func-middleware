import Middleware from './Middleware';
import ErrorMiddleware from './ErrorMiddleware';

export default (props) => {
  const { fn, predicate, isError } = props;
  
  return isError
    ? new ErrorMiddleware(fn)
    : new Middleware(fn, predicate);
};
