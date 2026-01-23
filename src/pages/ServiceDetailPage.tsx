import { useParams, useNavigate } from 'react-router-dom';
import { ServiceDetails } from '@/components/ServiceDetails';

/**
 * Service Detail Page
 * 
 * Wrapper page that displays detailed service information
 * including metrics, schema, and graph data.
 */
export function ServiceDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    if (!id) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Service ID not provided</p>
            </div>
        );
    }

    return (
        <ServiceDetails
            serviceId={id}
            onBack={() => navigate('/marketplace')}
            onCallService={(service) => {
                console.log('Call service:', service.name);
                // Integration point for service calling
            }}
        />
    );
}

export default ServiceDetailPage;
