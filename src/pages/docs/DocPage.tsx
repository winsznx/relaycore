interface DocPageProps {
    title: string;
    description: string;
    content?: React.ReactNode;
}

export default function DocPage({ title, description, content }: DocPageProps) {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">{title}</h1>
                <p className="text-lg text-gray-600">{description}</p>
            </div>

            {content || (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <p className="text-gray-600">
                        This documentation page is currently being written. Check back soon for detailed information about {title.toLowerCase()}.
                    </p>
                </div>
            )}
        </div>
    );
}
