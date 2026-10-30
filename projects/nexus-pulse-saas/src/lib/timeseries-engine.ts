/**
 * NexusPulse Time-Series Engine
 * High-speed 50,000+ data point ingestion, ring-buffer storage, and
 * Largest-Triangle-Three-Buckets (LTTB) downsampling algorithm for 60 FPS rendering.
 *
 * Designed and engineered by Mohamed Seddik Feki.
 */

export interface DataPoint {
  timestamp: number; // Unix epoch milliseconds or tick offset
  value: number;     // Primary metric value (e.g., requests/sec, latency ms)
  secondary?: number; // Optional secondary metric (e.g., CPU %, error count)
}

export interface MetricSummary {
  metricName: string;
  totalPoints: number;
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
  stdDev: number;
  latestValue: number;
}

export interface DownsampleResult {
  sampled: DataPoint[];
  originalCount: number;
  sampledCount: number;
  compressionRatio: number;
  durationMs: number;
}

/**
 * Largest-Triangle-Three-Buckets (LTTB) Downsampling Algorithm.
 *
 * Downsamples high-frequency time-series datasets from tens of thousands of points
 * down to a fixed visual resolution (e.g., 800-1500 points) while strictly preserving
 * waveform topology, local extrema, spikes, and visual nuances without visual distortion.
 *
 * Algorithmic Complexity: O(N) linear time, O(K) output space where K = threshold.
 *
 * @param data Source array of DataPoint objects ordered chronologically by timestamp
 * @param threshold Target number of output points (buckets)
 * @returns Downsampled array of exactly `threshold` DataPoint objects (or data.length if smaller)
 */
export function lttbDownsample(data: DataPoint[], threshold: number): DataPoint[] {
  const dataLength = data.length;
  const target = Math.floor(Number(threshold));

  // Edge cases: if target threshold is invalid or exceeds input size, return original
  if (isNaN(target) || target >= dataLength || target <= 2) {
    return data.slice();
  }

  const sampled: DataPoint[] = new Array(target);
  let sampledIndex = 0;

  // Bucket size in fractional floating point
  const every = (dataLength - 2) / (target - 2);

  // Always retain the first raw data point
  let a = 0;
  sampled[sampledIndex++] = data[a];

  for (let i = 0; i < target - 2; i++) {
    // Calculate the start and end of the current bucket
    const currentBucketStart = Math.floor((i + 0) * every) + 1;
    const currentBucketEnd = Math.floor((i + 1) * every) + 1;

    // Calculate the start and end of the next bucket to compute its average centroid
    const nextBucketStart = Math.floor((i + 1) * every) + 1;
    const nextBucketEnd = Math.min(Math.floor((i + 2) * every) + 1, dataLength);

    // Compute average (centroid) of the next bucket
    let avgX = 0;
    let avgY = 0;
    const nextBucketCount = nextBucketEnd - nextBucketStart;

    if (nextBucketCount > 0) {
      for (let j = nextBucketStart; j < nextBucketEnd; j++) {
        avgX += data[j].timestamp;
        avgY += data[j].value;
      }
      avgX /= nextBucketCount;
      avgY /= nextBucketCount;
    } else {
      // Fallback to last point if next bucket is empty
      avgX = data[dataLength - 1].timestamp;
      avgY = data[dataLength - 1].value;
    }

    // Point A coordinates (from previous bucket)
    const pointAX = data[a].timestamp;
    const pointAY = data[a].value;

    let maxArea = -1;
    let maxAreaPoint = currentBucketStart;

    // Search for point B in the current bucket that maximizes triangle area (A, B, C)
    for (let j = currentBucketStart; j < currentBucketEnd; j++) {
      const pointBX = data[j].timestamp;
      const pointBY = data[j].value;

      // Area of triangle = 0.5 * |(Ax - Cx)(By - Ay) - (Ax - Bx)(Cy - Ay)|
      const area = Math.abs(
        (pointAX - avgX) * (pointBY - pointAY) -
        (pointAX - pointBX) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = j;
      }
    }

    // Selected point B becomes point A for the next iteration
    sampled[sampledIndex++] = data[maxAreaPoint];
    a = maxAreaPoint;
  }

  // Always retain the last raw data point
  sampled[sampledIndex++] = data[dataLength - 1];

  return sampled;
}

/**
 * Enterprise Time-Series Engine
 * Manages in-memory streaming time-series buffers, high-throughput downsampling,
 * and statistical aggregations for the NexusPulse SaaS platform.
 */
export class TimeSeriesEngine {
  private buffer: DataPoint[] = [];
  private maxCapacity: number;
  private metricName: string;

  constructor(metricName = 'api_throughput_rps', maxCapacity = 100000) {
    this.metricName = metricName;
    this.maxCapacity = maxCapacity;
  }

  /**
   * Initializes the engine with synthetic high-frequency telemetry.
   * Synthesizes diurnal cyclical variation, random walk drift, and periodic traffic spikes.
   */
  public generateSyntheticDataset(
    pointCount = 50000,
    intervalMs = 1000,
    baseValue = 1250.0
  ): void {
    const count = Math.max(0, Math.floor(Number(pointCount)) || 0);
    if (count === 0) {
      this.buffer = [];
      return;
    }
    this.buffer = new Array(count);
    if (count > this.maxCapacity) {
      this.maxCapacity = count;
    }
    const now = Date.now();
    const startTime = now - (count * intervalMs);

    let drift = 0;
    for (let i = 0; i < count; i++) {
      const timestamp = startTime + (i * intervalMs);

      // Multi-harmonic cycle (representing diurnal traffic and micro-bursts)
      const dailyCycle = Math.sin((i / 3600) * Math.PI) * 320.0;
      const microWave = Math.sin((i / 45) * Math.PI) * 85.0;
      const rapidWave = Math.cos((i / 8) * Math.PI) * 25.0;

      // Brown-like noise / random walk with mean-reversion
      drift = (drift * 0.985) + ((Math.random() - 0.5) * 35.0);

      // Periodic anomaly spike (simulating load test or promotional spike)
      let anomaly = 0;
      if (i % 4200 === 0) {
        anomaly = 850.0 + (Math.random() * 400.0);
      } else if (i % 850 === 0) {
        anomaly = -280.0 - (Math.random() * 150.0);
      }

      const rawValue = baseValue + dailyCycle + microWave + rapidWave + drift + anomaly;
      const finalValue = Math.max(10.0, Math.round(rawValue * 100) / 100);

      // Secondary metric: CPU load percentage corresponding to throughput
      const cpuUsage = Math.min(99.4, Math.max(12.0, (finalValue / 20.0) + (Math.random() * 8.0)));

      this.buffer[i] = {
        timestamp,
        value: finalValue,
        secondary: Math.round(cpuUsage * 10) / 10
      };
    }
  }

  /**
   * Appends an incoming live data point to the time-series ring buffer.
   */
  public push(point: DataPoint): void {
    this.buffer.push(point);
    if (this.buffer.length > this.maxCapacity) {
      this.buffer.shift();
    }
  }

  /**
   * Returns current buffer length.
   */
  public get length(): number {
    return this.buffer.length;
  }

  /**
   * Retrieves raw data slice.
   */
  public getRawData(): DataPoint[] {
    return this.buffer;
  }

  /**
   * Downsamples the internal dataset to the target resolution using LTTB.
   */
  public getDownsampled(targetResolution = 1000): DownsampleResult {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const sampled = lttbDownsample(this.buffer, targetResolution);
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const originalCount = this.buffer.length;
    const sampledCount = sampled.length;
    const compressionRatio = sampledCount > 0 ? Math.round((originalCount / sampledCount) * 10) / 10 : 1;

    return {
      sampled,
      originalCount,
      sampledCount,
      compressionRatio,
      durationMs: Math.round((t1 - t0) * 100) / 100
    };
  }

  /**
   * Computes comprehensive descriptive statistics and percentiles across the buffer.
   */
  public computeSummary(): MetricSummary {
    const n = this.buffer.length;
    if (n === 0) {
      return {
        metricName: this.metricName,
        totalPoints: 0,
        min: 0,
        max: 0,
        avg: 0,
        p95: 0,
        p99: 0,
        stdDev: 0,
        latestValue: 0
      };
    }

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    // Use stride for fast percentile approximation if dataset is extremely large
    const values: number[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const v = this.buffer[i].value;
      values[i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }

    const avg = sum / n;

    // Variance & Standard Deviation
    let sumSqDiff = 0;
    for (let i = 0; i < n; i++) {
      const diff = values[i] - avg;
      sumSqDiff += diff * diff;
    }
    const stdDev = Math.sqrt(sumSqDiff / n);

    // Percentiles (via partial sort)
    values.sort((a, b) => a - b);
    const p95Index = Math.min(Math.floor(n * 0.95), n - 1);
    const p99Index = Math.min(Math.floor(n * 0.99), n - 1);

    return {
      metricName: this.metricName,
      totalPoints: n,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      avg: Math.round(avg * 100) / 100,
      p95: Math.round(values[p95Index] * 100) / 100,
      p99: Math.round(values[p99Index] * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      latestValue: this.buffer[n - 1].value
    };
  }
}
