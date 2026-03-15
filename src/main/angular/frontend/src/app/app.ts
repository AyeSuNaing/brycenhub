import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: true,
  imports: [RouterOutlet],
})
export class App {}


// import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
// import { HttpClient } from '@angular/common/http';

// @Component({
//   selector: 'app-root',
//   templateUrl: './app.html',
// })
// export class App implements OnInit {

//   message: string = "Loading...";

//   constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

//   ngOnInit(): void {
//     this.http.get("http://localhost:8080/api/welcome", { responseType: "text" })
//       .subscribe({
//         next: (data) => {
//           console.log("Response:", data);
//           this.message = data;
//           this.cdr.detectChanges();   // 🔥 force refresh
//         },
//         error: (err) => {
//           console.log("Error:", err);
//           this.message = "Backend error!";
//           this.cdr.detectChanges();
//         }
//       });
//   }
// }





// import { Component, signal } from '@angular/core';
// import { RouterOutlet } from '@angular/router';

// @Component({
//   selector: 'app-root',
//   imports: [RouterOutlet],
//   templateUrl: './app.html',
//   styleUrl: './app.css'
// })
// export class App {
//   protected readonly title = signal('frontend');
// }
