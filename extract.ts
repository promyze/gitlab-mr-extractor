import axios from 'axios';
import * as fs from 'fs';

require('dotenv').config();

// Configuration variables (set these accordingly)
const gitlabToken = process.env.GITLAB_TOKEN; // Your GitLab personal access token
if (!gitlabToken) {
    throw new Error('Please set the GITLAB_TOKEN environment variable');
}
const gitlabApiUrl = process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4'; // GitLab API URL
const projectId = process.env.GITLAB_PROJECT_ID?.toString() || ''; // The ID of the GitLab project
if (!projectId?.length)  {
    throw new Error('Please set the GITLAB_PROJECT_ID environment variable');
}
const startDate = process.env.START_DATE; // Start date in ISO format (e.g., '2023-01-01T00:00:00Z')
if (!startDate) {
    throw new Error('Please set the START_DATE environment variable');
}
const endDate = process.env.END_DATE; // End date in ISO format (e.g., '2023-12-31T23:59:59Z')
if (!endDate) {
    throw new Error('Please set the END_DATE environment variable');
}

// Function to fetch merge requests with pagination
async function fetchMergeRequests(page = 1): Promise<any[]> {
    const perPage = 100; // Maximum items per page
    const url = `${gitlabApiUrl}/projects/${encodeURIComponent(projectId)}/merge_requests`;
    const response = await axios.get(url, {
        headers: {
            'Private-Token': gitlabToken,
        },
        params: {
            state: 'all',
            created_after: startDate,
            created_before: endDate,
            per_page: perPage,
            page: page,
        },
    });

    const mergeRequests = response.data;
    const totalPages = parseInt(response.headers['x-total-pages'] || '1', 10);

    if (page < totalPages) {
        const nextPageMergeRequests = await fetchMergeRequests(page + 1);
        return mergeRequests.concat(nextPageMergeRequests);
    } else {
        return mergeRequests;
    }
}

async function getMergeRequestCommentsCount(mergeRequestIid) {
    const headers = {
        'Private-Token': gitlabToken,
    };

    try {
        // Fetch Notes
        let notes = [];
        let page = 1;
        let perPage = 100;
        let totalPages = 1;

        do {
            const notesResponse = await axios.get(
                `${gitlabApiUrl}/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/notes`,
                {
                    headers,
                    params: {
                        page,
                        per_page: perPage,
                    },
                }
            );

            notes = notes.concat(notesResponse.data);

            // Get total pages from headers
            totalPages = parseInt(notesResponse.headers['x-total-pages'], 10) || 1;
            page += 1;
        } while (page <= totalPages);

        // Filter out system notes if desired
        const userNotes = notes.filter(note => !note.system);

        // Fetch Discussions
        let discussions = [];
        page = 1;
        totalPages = 1;

        do {
            const discussionsResponse = await axios.get(
                `${gitlabApiUrl}/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/discussions`,
                {
                    headers,
                    params: {
                        page,
                        per_page: perPage,
                    },
                }
            );

            discussions = discussions.concat(discussionsResponse.data);

            // Get total pages from headers
            totalPages = parseInt(discussionsResponse.headers['x-total-pages'], 10) || 1;
            page += 1;
        } while (page <= totalPages);

        // Count total notes in discussions
        let discussionNotesCount = 0;
        discussions.forEach(discussion => {
            // Exclude system notes within discussions if desired
            const notesInDiscussion = discussion.notes.filter(note => !note.system);
            discussionNotesCount += notesInDiscussion.length;
        });

        // Total comments count
        const totalCommentsCount = userNotes.length + discussionNotesCount;
        return {
            totalCommentsCount,
            overviewCommentsCount: userNotes.length,
            codeDiscussionCommentsCount: discussionNotesCount,
        };
    } catch (error) {
        console.error('Error fetching comments:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Function to get details of a merge request
async function getMergeRequestDetails(iid: number): Promise<any> {
    const url = `${gitlabApiUrl}/projects/${encodeURIComponent(projectId)}/merge_requests/${iid}`;
    const response = await axios.get(url, {
        headers: {
            'Private-Token': gitlabToken,
        },
    });
    return response.data;
}

// Main function to execute the script
async function main() {
    try {
        const mergeRequests = await fetchMergeRequests();

        console.log(`Fetched ${mergeRequests.length} merge requests`);

        // Fetch merge request details concurrently
        const promises = mergeRequests.map(async (mr) => {
            const commentsCount = await getMergeRequestCommentsCount(mr.iid);

            const mrId = mr.iid;
            const mrUrl = mr.web_url;
            const openedDate = mr.created_at;
            const closedDate = mr.closed_at || mr.merged_at || 'opened';
            const state = mr.state;

            return {
                'Merge Request ID': mrId,
                'Merge Request URL': mrUrl,
                'State': state,
                'Opened Date': openedDate,
                'Closed Date': closedDate,
                'Comments': commentsCount.totalCommentsCount,
            };
        });

        const results = await Promise.all(promises);

        // Generate CSV content
        const csvHeader = 'Merge Request ID,Merge Request URL,State,Opened Date,Closed Date,Comments\n';
        const csvLines = results.map((result) => {
            // Escape commas in URLs
            const escapedUrl = `"${result['Merge Request URL']}"`;
            return `${result['Merge Request ID']},${escapedUrl},${result['State']},${result['Opened Date']},${result['Closed Date']},${result['Comments']}`;
        });
        const csvContent = csvHeader + csvLines.join('\n');

        // Write CSV file
        fs.writeFileSync('merge_requests.csv', csvContent);

        console.log('CSV file generated: merge_requests.csv');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Execute the main function
main();
