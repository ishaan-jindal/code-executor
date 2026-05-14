import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const VUS = Number(__ENV.VUS || 50);
const DURATION = __ENV.DURATION || "30s";

export const options = {
  vus: VUS,
  duration: DURATION,
};

interface SubmitPayload {
  language: string;
  code: string;
  stdin?: string;
}

interface SubmitResponseBody {
  job_id?: string;
  data?: {
    id?: string;
    status?: string;
  };
  status?: string;
}

function submitJob(payload: SubmitPayload) {
  return http.post(`${BASE_URL}/submit`, JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
}

function pollResult(jobId: string) {
  return http.get(`${BASE_URL}/result/${jobId}`);
}

export default function () {
  const payload = {
    language: "python",
    code: "print('ok')",
    stdin: "",
  };

  const submitRes = submitJob(payload);
  check(submitRes, {
    "submit status 201": (r) => r.status === 201,
  });

  if (submitRes.status !== 201) {
    sleep(1);
    return;
  }

  const body = submitRes.json<SubmitResponseBody>();
  const jobId = body?.job_id || body?.data?.id;
  if (!jobId) {
    sleep(1);
    return;
  }

  for (let i = 0; i < 10; i++) {
    const resultRes = pollResult(jobId);
    if (resultRes.status === 200) {
      const resultBody = resultRes.json<SubmitResponseBody>();
      const status = resultBody?.status || resultBody?.data?.status;
      if (status && status !== "QUEUED" && status !== "RUNNING") {
        check(resultRes, {
          "result completed": (r) => r.status === 200,
        });
        break;
      }
    }
    sleep(0.2);
  }

  sleep(0.1);
}
