import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IncomingCallComponent } from './shared/incoming-call/incoming-call.component';


@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: true,
  imports: [RouterOutlet, IncomingCallComponent],
})
export class App {}
