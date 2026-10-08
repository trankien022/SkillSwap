import { Redirect } from 'expo-router';
import { DEMO_CLASS_ID } from '@/infrastructure/mock/mock-booking-gateway';

/** Landing route: the mock demo sends the Learner straight to the class detail. */
export default function Index() {
  return <Redirect href={`/classes/${DEMO_CLASS_ID}`} />;
}
