'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Users, FileText, ArrowLeft, Copy, Share2, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Meeting {
  id: string;
  title: string;
  type: string;
  date: string;
  duration?: string;
  participants: Array<{ name: string; avatar?: string }>;
  summary?: {
    title?: string;
    content: string;
    sections?: Array<{
      title: string;
      points: Array<{
        text: string;
        speaker?: string;
        context?: {
          speaker: string;
          reasoning: string;
          transcriptExcerpt: string;
          relatedDiscussion: string;
        };
      }>;
    }>;
    keyPoints: string[]; // Keep for backward compatibility
    actionItems: Array<{
      title: string;
      owner: string;
      priority: string;
      dueDate?: string;
      context: string;
    }>;
    decisions: string[];
  };
  transcripts?: Array<{
    speaker: string;
    text: string;
    timestamp: string;
  }>;
  hasEmbeddings?: boolean; // Flag to indicate if transcripts are available in Pinecone
  transcriptCount?: number; // Number of transcripts available
}

interface SimpleMeetingViewProps {
  meetingId: string;
}

export function SimpleMeetingView({ meetingId }: SimpleMeetingViewProps) {
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [transcriptsLoading, setTranscriptsLoading] = useState(false);
  const [showTranscripts, setShowTranscripts] = useState(false);
  const [selectedContext, setSelectedContext] = useState<{
    speaker: string;
    reasoning: string;
    transcriptExcerpt: string;
    relatedDiscussion: string;
  } | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchMeeting();
  }, [meetingId, showTranscripts]);

  const fetchMeeting = async () => {
    try {
      // If we're fetching transcripts, set transcripts loading
      if (showTranscripts) {
        setTranscriptsLoading(true);
      }

      // Fetch meeting details with transcripts if needed
      const url = showTranscripts 
        ? `/api/meeting-details/${meetingId}?includeTranscripts=true`
        : `/api/meeting-details/${meetingId}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMeeting(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching meeting:', error);
    } finally {
      setLoading(false);
      setTranscriptsLoading(false);
    }
  };

  const handleBack = () => {
    // Check if we have workspace in URL params to navigate back properly
    const urlParams = new URLSearchParams(window.location.search);
    const workspaceId = urlParams.get('workspace');
    
    if (workspaceId) {
      // Navigate back to dashboard with workspace parameter
      router.push(`/?workspace=${workspaceId}`);
    } else {
      // Fallback to browser back
      router.back();
    }
  };

  const handleCopy = async () => {
    if (!meeting?.summary?.content) return;
    
    try {
      await navigator.clipboard.writeText(meeting.summary.content);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleShare = async () => {
    if (!meeting) return;

    const shareData = {
      title: meeting.title,
      text: meeting.summary?.content || 'Meeting summary',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy link to clipboard
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Function to assign consistent colors to speakers
  const getSpeakerColor = (speaker: string) => {
    const colors = [
      'border-blue-200 bg-blue-50',
      'border-green-200 bg-green-50', 
      'border-purple-200 bg-purple-50',
      'border-orange-200 bg-orange-50',
      'border-pink-200 bg-pink-50',
      'border-indigo-200 bg-indigo-50',
      'border-teal-200 bg-teal-50',
      'border-red-200 bg-red-50'
    ];
    
    // Generate consistent color based on speaker name
    let hash = 0;
    for (let i = 0; i < speaker.length; i++) {
      hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Function to collate transcripts by speaker
  const collateTranscriptsBySpeaker = (transcripts: any[]) => {
    if (!transcripts || transcripts.length === 0) return [];

    const collated: Array<{
      speaker: string;
      text: string;
      startTime: string;
      endTime: string;
    }> = [];

    let currentSpeaker = '';
    let currentText = '';
    let startTime = '';
    let endTime = '';

    transcripts.forEach((transcript, index) => {
      if (transcript.speaker !== currentSpeaker) {
        // Save previous speaker's text if exists
        if (currentSpeaker && currentText) {
          collated.push({
            speaker: currentSpeaker,
            text: currentText.trim(),
            startTime,
            endTime
          });
        }
        
        // Start new speaker section
        currentSpeaker = transcript.speaker;
        currentText = transcript.text || '';
        startTime = transcript.timestamp;
        endTime = transcript.timestamp;
      } else {
        // Continue with same speaker - add space only if both texts exist
        if (transcript.text) {
          currentText += (currentText ? ' ' : '') + transcript.text;
          endTime = transcript.timestamp;
        }
      }
    });

    // Don't forget the last speaker
    if (currentSpeaker && currentText) {
      collated.push({
        speaker: currentSpeaker,
        text: currentText.trim(),
        startTime,
        endTime
      });
    }

    return collated;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Meeting not found</h2>
          <p className="text-muted-foreground mb-4">The meeting you&apos;re looking for doesn&apos;t exist.</p>
          <Button onClick={handleBack} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className={cn(
          "max-w-4xl mx-auto",
          isMobile ? "px-4 py-3" : "px-6 py-4"
        )}>
          <div className={cn(
            "flex items-center justify-between",
            isMobile && "flex-col gap-3"
          )}>
            <div className={cn(
              "flex items-center gap-4",
              isMobile && "w-full"
            )}>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleBack}
                className={isMobile ? "h-8 w-8" : ""}
              >
                <ArrowLeft className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
              </Button>
              <div className="flex-1">
                <h1 className={cn(
                  "font-semibold text-foreground",
                  isMobile ? "text-lg" : "text-2xl"
                )}>{meeting.title}</h1>
                <div className={cn(
                  "flex items-center mt-1 text-muted-foreground",
                  isMobile ? "gap-3 text-xs flex-wrap" : "gap-4 text-sm"
                )}>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {meeting.date}
                  </span>
                  <button 
                    onClick={() => setShowParticipants(true)}
                    className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                  >
                    <Users className="h-3 w-3" />
                    {meeting.participants.length} participants
                  </button>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className={cn(
              "flex items-center gap-2",
              isMobile && "w-full"
            )}>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopy}
                className={cn(isMobile && "flex-1 text-xs")}
              >
                <Copy className={cn(isMobile ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2")} />
                Copy
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleShare}
                className={cn(isMobile && "flex-1 text-xs")}
              >
                <Share2 className={cn(isMobile ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2")} />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={cn(
        "max-w-4xl mx-auto",
        isMobile ? "px-4 py-6 space-y-6" : "px-6 py-8 space-y-8"
      )}>
        <div className={cn(isMobile ? "space-y-6" : "space-y-8")}>


          {/* AI-Generated Summary */}
          {meeting.summary && (
            <div className={cn(
              "bg-card rounded-lg border border-border",
              isMobile ? "p-4" : "p-6"
            )}>
              <h2 className={cn(
                "font-semibold text-foreground mb-4",
                isMobile ? "text-base" : "text-lg"
              )}>Meeting Summary</h2>
              <div className={cn(
                "prose max-w-none",
                isMobile ? "prose-sm text-sm" : "prose-sm"
              )}>
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {meeting.summary.content}
                </p>
              </div>

              {/* Detailed Sections */}
              {meeting.summary.sections && meeting.summary.sections.length > 0 && (
                <div className={cn(isMobile ? "mt-4 space-y-4" : "mt-6 space-y-6")}>
                  {meeting.summary.sections.map((section, sectionIndex) => (
                    <div key={sectionIndex}>
                      <h3 className={cn(
                        "font-medium text-foreground mb-3",
                        isMobile ? "text-sm" : "text-md"
                      )}># {section.title}</h3>
                      <ul className="space-y-2">
                        {section.points.map((point, pointIndex) => (
                          <li key={pointIndex} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                            <div className="flex-1">
                              <button
                                onClick={() => point.context && setSelectedContext(point.context)}
                                className={cn(
                                  "text-foreground text-left hover:text-primary transition-colors",
                                  isMobile ? "text-xs" : "text-sm",
                                  point.context ? 'cursor-pointer hover:underline' : 'cursor-default'
                                )}
                                disabled={!point.context}
                              >
                                {point.text}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* Fallback to Key Points for backward compatibility */}
              {(!meeting.summary.sections || meeting.summary.sections.length === 0) && meeting.summary.keyPoints && meeting.summary.keyPoints.length > 0 && meeting.summary.keyPoints.some(point => point && point.trim()) && (
                <div className="mt-6">
                  <h3 className="text-md font-medium text-foreground mb-3">Key Points</h3>
                  <ul className="space-y-2">
                    {meeting.summary.keyPoints.filter(point => point && point.trim()).map((point, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-sm text-foreground">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {meeting.summary.actionItems && meeting.summary.actionItems.length > 0 && meeting.summary.actionItems.some(item => item.title && item.title.trim()) && (
                <div className={cn(isMobile ? "mt-4" : "mt-6")}>
                  <h3 className={cn(
                    "font-medium text-foreground mb-3",
                    isMobile ? "text-sm" : "text-md"
                  )}>Action Items</h3>
                  <div className="space-y-3">
                    {meeting.summary.actionItems.filter(item => item.title && item.title.trim()).map((item, index) => (
                      <div key={index} className={cn(
                        "flex items-start gap-3 bg-orange-50 rounded-lg border border-orange-200",
                        isMobile ? "p-2" : "p-3"
                      )}>
                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                        <div className="flex-1">
                          <h4 className={cn(
                            "font-medium text-foreground",
                            isMobile ? "text-xs" : "text-sm"
                          )}>{item.title}</h4>
                          {item.context && (
                            <p className={cn(
                              "text-muted-foreground mt-1",
                              isMobile ? "text-xs" : "text-xs"
                            )}>{item.context}</p>
                          )}
                          <div className={cn(
                            "flex items-center mt-2 text-xs",
                            isMobile ? "gap-2 flex-wrap" : "gap-4"
                          )}>
                            {item.owner && item.owner !== 'Unassigned' && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span className="font-medium">{item.owner}</span>
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full font-medium ${
                              item.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                              item.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {item.priority}
                            </span>
                            {item.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {item.dueDate}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* View Transcripts Button */}
          {(meeting.hasEmbeddings || (meeting.transcriptCount && meeting.transcriptCount > 0)) && (
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => setShowTranscripts(!showTranscripts)}
                className="gap-2"
                  disabled={transcriptsLoading}
              >
                  {transcriptsLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  ) : (
                <FileText className="h-4 w-4" />
                  )}
                  {transcriptsLoading 
                    ? 'Loading Transcripts...' 
                    : showTranscripts 
                      ? 'Hide Transcripts' 
                      : 'View Transcripts'
                  }
              </Button>
            </div>
          )}

          {/* Transcripts */}
          {showTranscripts && (
            <div className={cn(
              "bg-card rounded-lg border border-border",
              isMobile ? "p-4" : "p-6"
            )}>
              <h2 className={cn(
                "font-semibold text-foreground mb-4",
                isMobile ? "text-base" : "text-lg"
              )}>Transcripts</h2>
              {transcriptsLoading ? (
                <div className={cn(
                  "flex items-center justify-center",
                  isMobile ? "py-6" : "py-8"
                )}>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className={cn(
                    "ml-3 text-muted-foreground",
                    isMobile && "text-sm"
                  )}>Loading transcripts from Pinecone...</span>
                </div>
              ) : meeting.transcripts && meeting.transcripts.length > 0 ? (
              <div className={cn(isMobile ? "space-y-3" : "space-y-4")}>
                  {collateTranscriptsBySpeaker(meeting.transcripts).map((section, index) => (
                    <div 
                      key={index} 
                      className={cn(
                        `rounded-lg border-l-4 ${getSpeakerColor(section.speaker)}`,
                        isMobile ? "p-3" : "p-4"
                      )}
                    >
                      <div className={cn(
                        "flex items-center justify-between mb-3",
                        isMobile && "flex-col items-start gap-2"
                      )}>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "bg-primary text-primary-foreground rounded-full flex items-center justify-center font-medium",
                            isMobile ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm"
                          )}>
                            {getInitials(section.speaker)}
                          </div>
                          <span className={cn(
                            "font-semibold text-foreground",
                            isMobile ? "text-xs" : "text-sm"
                          )}>{section.speaker}</span>
                        </div>
                        <div className={cn(
                          "text-muted-foreground",
                          isMobile ? "text-xs" : "text-xs"
                        )}>
                          {new Date(section.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                          {section.startTime !== section.endTime && (
                            <>
                              {' - '}
                              {new Date(section.endTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </>
                          )}
                        </div>
                      </div>
                      <p className={cn(
                        "text-foreground leading-relaxed whitespace-pre-wrap",
                        isMobile ? "text-xs" : "text-sm"
                      )}>
                        {section.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Transcripts Available</h3>
                  <p className="text-sm">This meeting doesn&apos;t have any transcript data.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Context Reference Popup */}
      {selectedContext && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border border-border max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Meeting Context & Discussion
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedContext(null)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              {/* Speaker & Reasoning */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {selectedContext.speaker.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <span className="font-medium text-blue-900">{selectedContext.speaker}</span>
                </div>
                <p className="text-sm text-blue-800 leading-relaxed">
                  <strong>Why this was said:</strong> {selectedContext.reasoning}
                </p>
              </div>

              {/* Exact Quote */}
              <div className="bg-muted/20 rounded-lg p-4 border border-muted">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Exact Quote
                  </span>
                </div>
                <blockquote className="text-sm text-foreground leading-relaxed italic border-l-4 border-primary pl-4">
                  &ldquo;{selectedContext.transcriptExcerpt}&rdquo;
                </blockquote>
              </div>

              {/* Related Discussion */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-medium text-green-700 uppercase tracking-wide">
                    Surrounding Discussion
                  </span>
                </div>
                <p className="text-sm text-green-800 leading-relaxed">
                  {selectedContext.relatedDiscussion}
                </p>
              </div>

              <div className="mt-4 text-xs text-muted-foreground bg-muted/10 rounded p-3">
                💡 This structured context shows who said what, why they said it, and the surrounding conversation for complete understanding.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Participants Popup */}
      {showParticipants && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border border-border max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5" />
                Meeting Participants
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowParticipants(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {meeting?.participants.map((participant, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                      {getInitials(participant.name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{participant.name}</p>
                      <p className="text-xs text-muted-foreground">Participant</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 