import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');

  if (token) {
    // FormData (multipart) ဆိုရင် Content-Type မထည့်ဘဲ
    // Authorization ပဲ ထည့်
    const isMultipart = req.body instanceof FormData;

    const cloned = req.clone({
      setHeaders: isMultipart
        ? { Authorization: `Bearer ${token}` }
        : {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
    });
    return next(cloned);
  }

  return next(req);
};

// import { HttpInterceptorFn } from '@angular/common/http';

// export const authInterceptor: HttpInterceptorFn = (req, next) => {
//   const token = localStorage.getItem('token');

//   if (token) {
//     const cloned = req.clone({
//       setHeaders: {
//         Authorization: `Bearer ${token}`,
//          'Content-Type': 'application/json',
//       }
//     });
//     return next(cloned);
//   }

//   return next(req);
// };
