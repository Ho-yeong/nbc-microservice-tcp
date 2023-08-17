/**
 * 상품 관리의 각 기능별로 분기
 */
const onRequest = (res, method, pathname, params, key, cb) => {
  switch (method) {
    case 'GET':
      return get(method, pathname, params, key, (response) => {
        process.nextTick(cb, res, response);
      });
    default:
      return process.nextTick(cb, res, null);
  }
};

function get(method, pathname, params, key, cb) {
  const response = {
    key,
    errorCode: 0,
    errormessage: 'success',
    data: {
      message: 'Hello',
    },
  };

  cb(response);
}

export default onRequest;
