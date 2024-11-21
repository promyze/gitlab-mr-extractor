# Gitlab merge request extractor

This scripts extract merge requests metadata over a period of time, from a Gitlab project.
It includes the opened date, merge/close date, and the number of comments (excluding system comments)

```
npm install
```

Copy the file `.env.example` to `.env` and fill the variables with your Gitlab credentials and API Endpoints.

Then run:
``` 
npm run extract
```

You'll get a file `merge_requests.csv` which looks like follows:

``` 
Merge Request ID,Merge Request URL,State,Opened Date,Closed Date,Comments
1013,"https://mygitlab.com/project/-/merge_requests/1013",merged,2024-11-21T14:29:54.505Z,2024-11-21T14:31:23.037Z,6
1012,"https://mygitlab.com/project/-/merge_requests/1012",merged,2024-11-21T13:12:50.862Z,2024-11-21T13:14:23.707Z,6
1011,"https://mygitlab.com/project/-/merge_requests/1011",merged,2024-11-21T13:12:48.555Z,2024-11-21T15:03:32.040Z,6
```